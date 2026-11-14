import { getSession } from "@/lib/auth";
import { getUserAccess, isMasterAdmin } from "@/lib/auth/platform-access";
import { monthSchema } from "@/lib/brewcc/billing";
import { getVercelMonthTotal } from "@/lib/brewcc/billing-server";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// GET /api/admin/billing/vercel?month=2026-11 – the Vercel team's charges for the month
// (month to date for the current month), to fill in the shared bill. Master admins only.
export async function GET(req: Request) {
  const session = await getSession();
  if (
    !session?.user?.id ||
    !isMasterAdmin(await getUserAccess(session.user.id))
  ) {
    return NextResponse.json(
      { error: { message: "Not found." } },
      { status: 404 },
    );
  }

  const parsed = monthSchema.safeParse(
    new URL(req.url).searchParams.get("month"),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid month." } },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await getVercelMonthTotal(parsed.data));
  } catch (e) {
    return NextResponse.json(
      { error: { message: (e as Error).message } },
      { status: 502 },
    );
  }
}
