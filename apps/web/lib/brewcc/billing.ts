import * as z from "zod/v4";

// Shared bill for BrewCC + BrewAds. Both apps run on the same provider accounts, so one
// report covers both: the Vercel bill is split 50:50 between the apps, then each app's
// costs (its Vercel half + its own database, Redis, analytics, storage) are split between
// that app's users by their share of its clicks. A user of both apps gets one bill with a
// line per app. Users are matched across apps by email. Domains are not billed here.

export const BILLING_APPS = ["brewcc", "brewads"] as const;
export type BillingApp = (typeof BILLING_APPS)[number];
export const BILLING_APP_LABEL: Record<BillingApp, string> = {
  brewcc: "BrewCC",
  brewads: "BrewAds",
};

export const COST_FIELDS = [
  { key: "planetscale", label: "PlanetScale (database)" },
  { key: "upstash", label: "Upstash (Redis + QStash)" },
  { key: "tinybird", label: "Tinybird (analytics)" },
  { key: "r2", label: "Cloudflare R2 (storage)" },
  { key: "other", label: "Other" },
] as const;
export type CostField = (typeof COST_FIELDS)[number]["key"];

const amount = z.coerce.number().min(0).max(1_000_000).default(0);
const appCostsSchema = z.object({
  planetscale: amount,
  upstash: amount,
  tinybird: amount,
  r2: amount,
  other: amount,
});

export const monthCostsSchema = z.object({
  vercel: amount, // whole Vercel team bill, split 50:50
  apps: z.object({ brewcc: appCostsSchema, brewads: appCostsSchema }),
});
export type MonthCosts = z.infer<typeof monthCostsSchema>;

export const emptyCosts = (): MonthCosts =>
  monthCostsSchema.parse({
    vercel: 0,
    apps: { brewcc: {}, brewads: {} },
  });

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must look like 2026-11");

export type AppUsage = {
  app: BillingApp;
  users: {
    email: string;
    name: string | null;
    clicks: number;
    workspaces: { slug: string; name: string; clicks: number }[];
  }[];
};

export type BillLine = {
  clicks: number;
  amount: number;
  workspaces: { slug: string; name: string; clicks: number }[];
};

export type Bill = {
  totalCost: number;
  pools: Record<BillingApp, number>; // each app's costs incl. its Vercel half
  clicks: Record<BillingApp, number>;
  unassigned: Record<BillingApp, number>; // pool of an app with no clicks this month
  users: {
    email: string;
    name: string | null;
    total: number;
    apps: Partial<Record<BillingApp, BillLine>>;
  }[];
};

const toCents = (n: number) => Math.round(n * 100);

// Splits `cents` by weight so the parts add up exactly (largest remainder).
function splitCents(cents: number, weights: number[]) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (cents * w) / total);
  const parts = raw.map(Math.floor);
  let left = cents - parts.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (left > 0) {
        parts[i]++;
        left--;
      }
    });
  return parts;
}

export function appPoolCents(costs: MonthCosts) {
  const [vercelBrewcc, vercelBrewads] = splitCents(
    toCents(costs.vercel),
    [1, 1],
  );
  const vercelHalf: Record<BillingApp, number> = {
    brewcc: vercelBrewcc,
    brewads: vercelBrewads,
  };
  return Object.fromEntries(
    BILLING_APPS.map((app) => [
      app,
      vercelHalf[app] +
        COST_FIELDS.reduce(
          (sum, f) => sum + toCents(costs.apps[app][f.key]),
          0,
        ),
    ]),
  ) as Record<BillingApp, number>;
}

export function computeBill(costs: MonthCosts, usages: AppUsage[]): Bill {
  const pools = appPoolCents(costs);
  const byEmail = new Map<string, Bill["users"][number]>();
  const clicks = { brewcc: 0, brewads: 0 } as Record<BillingApp, number>;
  const unassigned = { ...pools };

  for (const usage of usages) {
    const users = usage.users.filter((u) => u.clicks > 0);
    const appClicks = users.reduce((s, u) => s + u.clicks, 0);
    clicks[usage.app] = appClicks;
    if (appClicks === 0) continue;

    unassigned[usage.app] = 0;
    const shares = splitCents(
      pools[usage.app],
      users.map((u) => u.clicks),
    );
    users.forEach((u, i) => {
      const key = u.email.trim().toLowerCase();
      const entry = byEmail.get(key) ?? {
        email: key,
        name: u.name,
        total: 0,
        apps: {},
      };
      entry.name ??= u.name;
      entry.apps[usage.app] = {
        clicks: u.clicks,
        amount: shares[i] / 100,
        workspaces: u.workspaces,
      };
      entry.total = Math.round((entry.total + shares[i] / 100) * 100) / 100;
      byEmail.set(key, entry);
    });
  }

  return {
    totalCost: (pools.brewcc + pools.brewads) / 100,
    pools: { brewcc: pools.brewcc / 100, brewads: pools.brewads / 100 },
    clicks,
    unassigned: {
      brewcc: unassigned.brewcc / 100,
      brewads: unassigned.brewads / 100,
    },
    users: [...byEmail.values()].sort((a, b) => b.total - a.total),
  };
}

// first and next month boundaries (UTC) for "2026-11"
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

export function previousMonth(month: string) {
  const { start } = monthRange(month);
  const prev = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1),
  );
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}
