import { getFolderIdsToFilter } from "@/lib/analytics/get-folder-ids-to-filter";
import { DubApiError, ErrorCodes } from "@/lib/api/errors";
import {
  createLink,
  deleteLink,
  getLinksForWorkspace,
  processLink,
  updateLink,
} from "@/lib/api/links";
import { getLinkOrThrow } from "@/lib/api/links/get-link-or-throw";
import { throwIfLinksUsageExceeded } from "@/lib/api/links/usage-checks";
import { isRootDomainLinkKey } from "@/lib/api/links/utils/is-root-domain-link-key";
import { getSharedDomains } from "@/lib/brewcc/shared-domains";
import { verifyFolderAccess } from "@/lib/folder/permissions";
import { prisma } from "@/lib/prisma";
import { NewLinkProps, WorkspaceWithUsers } from "@/lib/types";
import { sendWorkspaceWebhook } from "@/lib/webhook/publish";
import {
  createLinkBodySchemaAsync,
  getLinksQuerySchemaExtended,
  linkEventSchema,
  updateLinkBodySchemaExtended,
} from "@/lib/zod/schemas/links";
import { DEFAULT_DOMAIN_COLUMNS, defaultDomainColumnToSlug } from "@dub/utils";
import { waitUntil } from "@vercel/functions";
import { LINKS_PAGE_SIZE } from "./config";

// Link operations for the Telegram bot. Each function mirrors the matching REST handler
// (app/api/links/route.ts and app/api/links/[linkId]/route.ts) and reuses the same
// library calls, so validation, folder permissions, caches and webhooks behave identically.

type Ctx = { workspace: WorkspaceWithUsers; userId: string };

export async function listLinks({
  workspace,
  userId,
  page,
  search,
  domain,
}: Ctx & { page: number; search?: string; domain?: string }) {
  const folderIds = await getFolderIdsToFilter({ workspace, userId });

  // same query schema (and defaults) as GET /api/links
  const filters = getLinksQuerySchemaExtended.parse({
    ...(search && { search }),
    ...(domain && { domain }),
    page: String(page),
    // one extra row tells us whether there is a next page
    pageSize: String(LINKS_PAGE_SIZE + 1),
    sortBy: "createdAt",
  });

  const ids = folderIds?.filter((id) => id !== "");
  const links = await getLinksForWorkspace({
    ...filters,
    workspaceId: workspace.id,
    folderIds: ids?.length ? ids : undefined,
    searchMode: "fuzzy",
  });

  return {
    links: links.slice(0, LINKS_PAGE_SIZE),
    hasNext: links.length > LINKS_PAGE_SIZE,
  };
}

// The link must belong to the workspace (getLinkOrThrow) and its folder must be readable
export async function getOwnedLink({
  workspace,
  userId,
  linkId,
  permission = "folders.read",
}: Ctx & {
  linkId: string;
  permission?: "folders.read" | "folders.links.write";
}) {
  const link = await getLinkOrThrow({ workspaceId: workspace.id, linkId });
  if (link.folderId) {
    await verifyFolderAccess({
      workspace,
      userId,
      folderId: link.folderId,
      requiredPermission: permission,
    });
  }
  return link;
}

// Domains this workspace can create links on: its own active domains, the shared pool and
// the enabled default domains (same sources as the dashboard link builder)
export async function getAvailableDomains(workspace: WorkspaceWithUsers) {
  const [own, shared, defaults] = await Promise.all([
    prisma.domain.findMany({
      where: { projectId: workspace.id, archived: false },
      select: { slug: true, verified: true },
      orderBy: [{ primary: "desc" }, { slug: "asc" }],
    }),
    getSharedDomains({ excludeWorkspaceId: workspace.id }),
    prisma.defaultDomains.findUnique({ where: { projectId: workspace.id } }),
  ]);

  const defaultSlugs = defaults
    ? DEFAULT_DOMAIN_COLUMNS.filter((column) => defaults[column])
        .map((column) => defaultDomainColumnToSlug(column))
        .filter((slug): slug is string => Boolean(slug))
    : [];

  return [
    ...new Set([
      ...own.filter((d) => d.verified).map((d) => d.slug),
      ...shared.map((d) => d.slug),
      ...defaultSlugs,
    ]),
  ];
}

const processError = (error: string, code?: string) =>
  new DubApiError({
    code: (code as ErrorCodes) || "bad_request",
    message: error,
  });

export async function createLinkFromBot({
  workspace,
  userId,
  domain,
  url,
  key,
  title,
}: Ctx & { domain: string; url: string; key?: string; title?: string }) {
  throwIfLinksUsageExceeded(workspace);

  const body = await createLinkBodySchemaAsync.parseAsync({
    domain,
    url,
    ...(key && { key }),
    ...(title && { title }),
  });

  const { link, error, code } = await processLink({
    payload: body,
    workspace,
    userId,
  });
  if (error != null) throw processError(error, code);

  const response = await createLink(link);

  waitUntil(
    sendWorkspaceWebhook({
      trigger: "link.created",
      workspace,
      data: linkEventSchema.parse(response),
    }),
  );

  return response;
}

export async function updateLinkFromBot({
  workspace,
  userId,
  linkId,
  changes,
}: Ctx & {
  linkId: string;
  changes: Partial<Pick<NewLinkProps, "url" | "key" | "domain" | "title">>;
}) {
  const link = await getOwnedLink({
    workspace,
    userId,
    linkId,
    permission: "folders.links.write",
  });

  if (isRootDomainLinkKey(link.key)) {
    throw new DubApiError({
      code: "forbidden",
      message: "Root domain links can only be changed in the dashboard.",
    });
  }

  const body = (await updateLinkBodySchemaExtended.parseAsync(changes)) || {};

  const updatedLink = {
    ...link,
    expiresAt:
      link.expiresAt instanceof Date
        ? link.expiresAt.toISOString()
        : link.expiresAt,
    geo: link.geo as NewLinkProps["geo"],
    ...body,
  };

  const skipKeyChecks =
    link.domain === updatedLink.domain &&
    link.key.toLowerCase() === updatedLink.key?.toLowerCase();

  const {
    link: processedLink,
    error,
    code,
  } = await processLink({
    payload: updatedLink,
    workspace,
    skipKeyChecks,
    skipExternalIdChecks: true,
    skipFolderChecks: true,
  });
  if (error) throw processError(error, code);

  const response = await updateLink({
    oldLink: { domain: link.domain, key: link.key, image: link.image },
    updatedLink: processedLink,
  });

  waitUntil(
    sendWorkspaceWebhook({
      trigger: "link.updated",
      workspace,
      data: linkEventSchema.parse(response),
    }),
  );

  return response;
}

export async function deleteLinkFromBot({
  workspace,
  userId,
  linkId,
}: Ctx & { linkId: string }) {
  const link = await getOwnedLink({
    workspace,
    userId,
    linkId,
    permission: "folders.links.write",
  });

  if (isRootDomainLinkKey(link.key)) {
    throw new DubApiError({
      code: "forbidden",
      message:
        "You can't delete a custom domain link. You can delete the domain instead.",
    });
  }

  const response = await deleteLink(link.id);

  waitUntil(
    sendWorkspaceWebhook({
      trigger: "link.deleted",
      workspace,
      data: linkEventSchema.parse(response),
    }),
  );

  return link;
}
