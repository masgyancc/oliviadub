import { TelegramUpdate } from "@/lib/telegram/api";
import { handleUpdate } from "@/lib/telegram/bot";
import { isTelegramConfigured } from "@/lib/telegram/config";
import { isDuplicateUpdate } from "@/lib/telegram/session";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const maxDuration = 30;

const secretMatches = (provided: string | null) => {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

// POST /api/telegram/webhook – Telegram Bot API webhook (setWebhook with secret_token)
export async function POST(req: Request) {
  if (!isTelegramConfigured()) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (typeof update?.update_id !== "number") {
    return NextResponse.json({ ok: true });
  }

  // Telegram retries until it gets a 2xx; handle each update once
  if (await isDuplicateUpdate(update.update_id)) {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleUpdate(update);
  } catch (error) {
    console.error("[telegram] update failed", error);
  }

  // always 200 so Telegram doesn't retry an update we already attempted
  return NextResponse.json({ ok: true });
}
