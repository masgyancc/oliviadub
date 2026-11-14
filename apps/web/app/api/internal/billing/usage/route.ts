import { monthSchema } from "@/lib/brewcc/billing";
import {
  getLocalUsage,
  isBillingSecretValid,
} from "@/lib/brewcc/billing-server";
import { NextResponse } from "next/server";

export const maxDuration = 30;

// GET /api/internal/billing/usage?month=2026-11 – this app's clicks per workspace owner for
// the shared bill. Only the other app (BrewCC / BrewAds) can call it, with the shared secret.
export async function GET(req: Request) {
  if (!isBillingSecretValid(req.headers.get("x-billing-secret"))) {
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

  return NextResponse.json(await getLocalUsage(parsed.data));
}
