import { DubApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { updateLinkFromBot as updateLinkDestination } from "@/lib/telegram/links";
import { WorkspaceWithUsers } from "@/lib/types";
import { nanoid } from "@dub/utils";
import { parseDomainInput, replaceDomain } from "./replace-domain";

// BrewCC Bulk Destination Replacement.
//
// Ownership: every query is limited to links in the CURRENT workspace (membership and
// links.write already enforced by withWorkspace) that were CREATED BY the session user
// (`userId = session.user.id`). Admin rights never widen this scope. The user id always comes
// from the server session, never from the request body.
//
// Each link is updated through the same pipeline as the dashboard editor (processLink →
// updateLink: validation, Redis link cache, Tinybird metadata, webhooks). Only `url` changes.

export const MAX_LINKS_PER_RUN = 500;

type Scope = { workspace: WorkspaceWithUsers; userId: string };

const ownedWhere = ({ workspace, userId }: Scope) => ({
  projectId: workspace.id,
  userId,
  key: { not: "_root" }, // root domain links belong to domain settings
});

function parseInputs(oldDomain: string, newDomain: string) {
  const from = parseDomainInput(oldDomain);
  if (!from.ok) {
    throw new DubApiError({
      code: "bad_request",
      message: `Old domain: ${from.error}`,
    });
  }
  const to = parseDomainInput(newDomain);
  if (!to.ok) {
    throw new DubApiError({
      code: "bad_request",
      message: `New domain: ${to.error}`,
    });
  }
  if (from.matchKey === to.matchKey) {
    throw new DubApiError({
      code: "bad_request",
      message: "The old and new domain are the same.",
    });
  }
  return { from, to };
}

// other targets that may still point at the old domain (shown as a warning, not changed)
function otherTargetsUseDomain(
  link: {
    ios: string | null;
    android: string | null;
    geo: unknown;
    testVariants: unknown;
  },
  oldKey: string,
) {
  const urls = [
    link.ios,
    link.android,
    ...Object.values((link.geo as Record<string, string> | null) ?? {}),
    ...((link.testVariants as { url?: string }[] | null) ?? []).map(
      (v) => v?.url,
    ),
  ].filter((u): u is string => typeof u === "string");
  return urls.some(
    (u) => replaceDomain(u, oldKey, "https://x.invalid") !== null,
  );
}

export async function previewReplacement({
  workspace,
  userId,
  oldDomain,
  newDomain,
  linkIds,
}: Scope & { oldDomain: string; newDomain: string; linkIds?: string[] }) {
  const { from, to } = parseInputs(oldDomain, newDomain);
  const hostFragment = from.matchKey.split(":")[0];

  const where = {
    ...ownedWhere({ workspace, userId }),
    ...(linkIds && { id: { in: linkIds } }),
  };

  const [checked, candidates] = await Promise.all([
    prisma.link.count({ where }),
    // cheap pre-filter in SQL; the exact domain match happens in replaceDomain()
    prisma.link.findMany({
      where: { ...where, url: { contains: hostFragment } },
      select: {
        id: true,
        shortLink: true,
        url: true,
        ios: true,
        android: true,
        geo: true,
        testVariants: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const matches = candidates.flatMap((link) => {
    const newUrl = replaceDomain(link.url, from.matchKey, to.origin);
    if (!newUrl) return [];
    return [
      {
        linkId: link.id,
        shortLink: link.shortLink,
        oldUrl: link.url,
        newUrl,
        otherTargetsWarning: otherTargetsUseDomain(link, from.matchKey),
      },
    ];
  });

  return {
    checked,
    matched: matches.length,
    limit: MAX_LINKS_PER_RUN,
    items: matches.slice(0, MAX_LINKS_PER_RUN),
  };
}

async function runInBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export async function applyReplacement({
  workspace,
  userId,
  oldDomain,
  newDomain,
  items,
}: Scope & {
  oldDomain: string;
  newDomain: string;
  items: { linkId: string; expectedUrl: string }[];
}) {
  const { from, to } = parseInputs(oldDomain, newDomain);
  if (items.length > MAX_LINKS_PER_RUN) {
    throw new DubApiError({
      code: "bad_request",
      message: `At most ${MAX_LINKS_PER_RUN} links per run.`,
    });
  }

  // re-read with the ownership filter: ids of other users' links simply don't come back
  const links = await prisma.link.findMany({
    where: {
      ...ownedWhere({ workspace, userId }),
      id: { in: items.map((i) => i.linkId) },
    },
    select: { id: true, url: true },
  });
  const byId = new Map(links.map((l) => [l.id, l]));

  const runId = `rep_${nanoid(16)}`;
  const result = {
    runId,
    checked: items.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };
  const changes: { linkId: string; oldUrl: string; newUrl: string }[] = [];

  await runInBatches(items, 5, async ({ linkId, expectedUrl }) => {
    const link = byId.get(linkId);
    // not owned / deleted, or edited since the preview → leave it alone
    if (!link || link.url !== expectedUrl) {
      result.skipped++;
      return;
    }
    const newUrl = replaceDomain(link.url, from.matchKey, to.origin);
    if (!newUrl) {
      result.skipped++;
      return;
    }
    result.matched++;
    try {
      await updateLinkDestination({
        workspace,
        userId,
        linkId,
        changes: { url: newUrl },
      });
      changes.push({ linkId, oldUrl: link.url, newUrl });
      result.updated++;
    } catch (error) {
      console.error("[bulk-replace] update failed", linkId, error);
      result.failed++;
    }
  });

  if (changes.length) {
    await prisma.linkUrlReplacement.createMany({
      data: changes.map((c) => ({
        ...c,
        runId,
        projectId: workspace.id,
        userId,
      })),
    });
  }

  await prisma.adminAuditLog.create({
    data: {
      actorId: userId,
      action: "links.bulk_replace",
      targetUserId: userId,
      fromValue: from.matchKey,
      toValue: to.origin,
      reason: `run ${runId}: ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed`,
    },
  });

  return result;
}

export async function listRuns(scope: Scope) {
  const rows = await prisma.linkUrlReplacement.findMany({
    where: { projectId: scope.workspace.id, userId: scope.userId },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      runId: true,
      oldUrl: true,
      newUrl: true,
      revertedAt: true,
      createdAt: true,
    },
  });

  const runs = new Map<
    string,
    {
      runId: string;
      createdAt: Date;
      count: number;
      reverted: number;
      sample: { oldUrl: string; newUrl: string };
    }
  >();
  for (const row of rows) {
    const run = runs.get(row.runId) ?? {
      runId: row.runId,
      createdAt: row.createdAt,
      count: 0,
      reverted: 0,
      sample: { oldUrl: row.oldUrl, newUrl: row.newUrl },
    };
    run.count++;
    if (row.revertedAt) run.reverted++;
    runs.set(row.runId, run);
  }
  return [...runs.values()].slice(0, 10);
}

// Undo: revert only links whose URL is still exactly what the run set (later edits win)
export async function undoRun({
  workspace,
  userId,
  runId,
}: Scope & { runId: string }) {
  const rows = await prisma.linkUrlReplacement.findMany({
    where: { runId, projectId: workspace.id, userId, revertedAt: null },
  });
  if (rows.length === 0) {
    throw new DubApiError({
      code: "not_found",
      message: "Nothing to undo for this run.",
    });
  }

  const links = await prisma.link.findMany({
    where: {
      ...ownedWhere({ workspace, userId }),
      id: { in: rows.map((r) => r.linkId) },
    },
    select: { id: true, url: true },
  });
  const byId = new Map(links.map((l) => [l.id, l]));

  const result = { reverted: 0, skipped: 0, failed: 0 };
  await runInBatches(rows, 5, async (row) => {
    const link = byId.get(row.linkId);
    if (!link || link.url !== row.newUrl) {
      result.skipped++;
      return;
    }
    try {
      await updateLinkDestination({
        workspace,
        userId,
        linkId: row.linkId,
        changes: { url: row.oldUrl },
      });
      await prisma.linkUrlReplacement.update({
        where: { id: row.id },
        data: { revertedAt: new Date() },
      });
      result.reverted++;
    } catch (error) {
      console.error("[bulk-replace] undo failed", row.linkId, error);
      result.failed++;
    }
  });

  await prisma.adminAuditLog.create({
    data: {
      actorId: userId,
      action: "links.bulk_replace_undo",
      targetUserId: userId,
      reason: `run ${runId}: ${result.reverted} reverted, ${result.skipped} skipped, ${result.failed} failed`,
    },
  });

  return result;
}
