import { getSession } from "@/lib/auth";
import { getUserAccess, isMasterAdmin } from "@/lib/auth/platform-access";
import {
  AppUsage,
  computeBill,
  monthCostsSchema,
  monthSchema,
} from "@/lib/brewcc/billing";
import {
  currentBillingApp,
  getCosts,
  getLocalUsage,
  getPeerUsage,
  saveCosts,
} from "@/lib/brewcc/billing-server";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

export const maxDuration = 60;

async function requireMasterAdmin() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return isMasterAdmin(await getUserAccess(session.user.id)) ? session : null;
}

const forbidden = () =>
  NextResponse.json({ error: { message: "Not found." } }, { status: 404 });

// GET /api/admin/billing?month=2026-11 – the shared BrewCC + BrewAds bill (master admins)
export async function GET(req: Request) {
  if (!(await requireMasterAdmin())) return forbidden();

  const parsed = monthSchema.safeParse(
    new URL(req.url).searchParams.get("month"),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid month." } },
      { status: 400 },
    );
  }
  const month = parsed.data;

  const [costs, local, peer] = await Promise.all([
    getCosts(month),
    getLocalUsage(month).then(
      (usage) => ({ usage, error: null }),
      (e: Error) => ({ usage: null, error: e.message }),
    ),
    getPeerUsage(month).then(
      (usage) => ({ usage, error: null }),
      (e: Error) => ({ usage: null, error: e.message }),
    ),
  ]);

  const usages = [local.usage, peer.usage].filter(Boolean) as AppUsage[];

  return NextResponse.json({
    month,
    app: currentBillingApp(),
    ...costs,
    bill: computeBill(costs.costs, usages),
    errors: { local: local.error, peer: peer.error },
  });
}

const putSchema = z.object({ month: monthSchema, costs: monthCostsSchema });

// PUT /api/admin/billing – save the month's costs here and in the other app
export async function PUT(req: Request) {
  const session = await requireMasterAdmin();
  if (!session) return forbidden();

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid costs." } },
      { status: 400 },
    );
  }
  const result = await saveCosts(
    parsed.data.month,
    parsed.data.costs,
    session.user.id,
  );
  return NextResponse.json(result);
}
