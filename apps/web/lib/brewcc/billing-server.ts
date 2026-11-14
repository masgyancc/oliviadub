import "server-only";

import { normalizeWorkspaceId } from "@/lib/api/workspaces/workspace-id";
import { prisma } from "@/lib/prisma";
import { timingSafeEqual } from "crypto";
import {
  AppUsage,
  BillingApp,
  emptyCosts,
  MonthCosts,
  monthCostsSchema,
  monthRange,
  previousMonth,
} from "./billing";

// Server side of the shared BrewCC + BrewAds bill. Each app reads its own clicks (Tinybird)
// and workspace owners (database), and fetches the other app's through a small internal
// endpoint protected by BILLING_SHARED_SECRET. Monthly costs are stored in both apps'
// PlatformSetting so either admin panel shows the same report.

const costKey = (month: string) => `billing:costs:${month}`;

export function currentBillingApp(): BillingApp {
  const fromEnv = process.env.BILLING_APP;
  if (fromEnv === "brewcc" || fromEnv === "brewads") return fromEnv;
  return (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "").includes("brewads")
    ? "brewads"
    : "brewcc";
}

export function isBillingSecretValid(provided: string | null) {
  const expected = process.env.BILLING_SHARED_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const tbTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

// clicks per workspace in the month, from Tinybird
async function clicksByWorkspace(month: string) {
  const { start, end } = monthRange(month);
  const sql =
    "SELECT workspace_id, count() AS clicks FROM dub_click_events " +
    `WHERE timestamp >= toDateTime('${tbTime(start)}') AND timestamp < toDateTime('${tbTime(end)}') ` +
    "GROUP BY workspace_id FORMAT JSON";

  const res = await fetch(`${process.env.TINYBIRD_API_URL}/v0/sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TINYBIRD_API_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q: sql }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Tinybird ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const { data } = (await res.json()) as {
    data: { workspace_id: string; clicks: number }[];
  };
  return data.filter((r) => r.workspace_id && Number(r.clicks) > 0);
}

// This app's clicks for the month, attributed to each workspace's owner.
export async function getLocalUsage(month: string): Promise<AppUsage> {
  const rows = await clicksByWorkspace(month);
  const ids = [
    ...new Set(
      rows.flatMap((r) => [
        r.workspace_id,
        normalizeWorkspaceId(r.workspace_id),
      ]),
    ),
  ];

  const workspaces = ids.length
    ? await prisma.project.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          slug: true,
          name: true,
          users: {
            where: { role: "owner" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { user: { select: { email: true, name: true } } },
          },
        },
      })
    : [];
  const byId = new Map(workspaces.map((w) => [w.id, w]));

  const users = new Map<string, AppUsage["users"][number]>();
  for (const row of rows) {
    const ws =
      byId.get(row.workspace_id) ??
      byId.get(normalizeWorkspaceId(row.workspace_id));
    const owner = ws?.users[0]?.user;
    // clicks of deleted or ownerless workspaces stay in the app's unassigned total
    if (!ws || !owner?.email) continue;

    const email = owner.email.toLowerCase();
    const entry = users.get(email) ?? {
      email,
      name: owner.name,
      clicks: 0,
      workspaces: [],
    };
    entry.clicks += Number(row.clicks);
    entry.workspaces.push({
      slug: ws.slug,
      name: ws.name,
      clicks: Number(row.clicks),
    });
    users.set(email, entry);
  }

  return { app: currentBillingApp(), users: [...users.values()] };
}

async function callPeer(path: string, init: RequestInit = {}) {
  const peer = process.env.BILLING_PEER_URL;
  const secret = process.env.BILLING_SHARED_SECRET;
  if (!peer || !secret) {
    throw new Error(
      "The other app isn't connected yet (BILLING_PEER_URL / BILLING_SHARED_SECRET).",
    );
  }
  const res = await fetch(`${peer.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      "Content-Type": "application/json",
      "x-billing-secret": secret,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`${peer} answered ${res.status}`);
  }
  return res.json();
}

export async function getPeerUsage(month: string): Promise<AppUsage> {
  return callPeer(`/api/internal/billing/usage?month=${month}`);
}

// Costs saved for the month; when none yet, last month's are offered (fixed costs repeat).
export async function getCosts(month: string): Promise<{
  costs: MonthCosts;
  saved: boolean;
  carriedFrom: string | null;
}> {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: [costKey(month), costKey(previousMonth(month))] } },
  });
  const parse = (key: string) => {
    const row = rows.find((r) => r.key === key);
    if (!row) return null;
    const parsed = monthCostsSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : null;
  };

  const current = parse(costKey(month));
  if (current) return { costs: current, saved: true, carriedFrom: null };
  const prev = parse(costKey(previousMonth(month)));
  if (prev)
    return { costs: prev, saved: false, carriedFrom: previousMonth(month) };
  return { costs: emptyCosts(), saved: false, carriedFrom: null };
}

export async function saveCostsLocal(
  month: string,
  costs: MonthCosts,
  userId?: string,
) {
  const value = JSON.stringify(monthCostsSchema.parse(costs));
  await prisma.platformSetting.upsert({
    where: { key: costKey(month) },
    create: { key: costKey(month), value, updatedById: userId ?? null },
    update: { value, updatedById: userId ?? null },
  });
}

// Saves here and in the other app, so both panels show the same numbers.
export async function saveCosts(
  month: string,
  costs: MonthCosts,
  userId: string,
) {
  await saveCostsLocal(month, costs, userId);
  try {
    await callPeer("/api/internal/billing/costs", {
      method: "PUT",
      body: JSON.stringify({ month, costs }),
    });
    return { syncedToPeer: true as const };
  } catch (error) {
    return {
      syncedToPeer: false as const,
      peerError: (error as Error).message,
    };
  }
}

// Total of the Vercel team's charges in the month (FOCUS rows from the billing API).
export async function getVercelMonthTotal(month: string) {
  const { start, end } = monthRange(month);
  const to = end > new Date() ? new Date() : end;
  const params = new URLSearchParams({
    teamId: process.env.TEAM_ID_VERCEL ?? "",
    from: start.toISOString(),
    to: to.toISOString(),
  });
  const res = await fetch(
    `https://api.vercel.com/v1/billing/charges?${params}`,
    {
      headers: { Authorization: `Bearer ${process.env.VERCEL_API_KEY}` },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`Vercel billing API answered ${res.status}`);

  let total = 0;
  for (const line of (await res.text()).split("\n")) {
    if (!line.trim()) continue;
    try {
      total += Number(JSON.parse(line).BilledCost) || 0;
    } catch {
      // ignore a malformed line
    }
  }
  return { total: Math.round(total * 100) / 100, until: to.toISOString() };
}
