import { monthCostsSchema, monthSchema } from "@/lib/brewcc/billing";
import {
  isBillingSecretValid,
  saveCostsLocal,
} from "@/lib/brewcc/billing-server";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

const schema = z.object({ month: monthSchema, costs: monthCostsSchema });

// PUT /api/internal/billing/costs – the other app saved the month's costs; keep the same
// copy here so both admin panels show the same bill. Shared secret only.
export async function PUT(req: Request) {
  if (!isBillingSecretValid(req.headers.get("x-billing-secret"))) {
    return NextResponse.json(
      { error: { message: "Not found." } },
      { status: 404 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid costs." } },
      { status: 400 },
    );
  }

  await saveCostsLocal(parsed.data.month, parsed.data.costs);
  return NextResponse.json({ ok: true });
}
