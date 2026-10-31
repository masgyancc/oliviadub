import { DubApiError } from "@/lib/api/errors";
import { withSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isTelegramConfigured,
  TELEGRAM_BOT_USERNAME,
} from "@/lib/telegram/config";
import {
  createTelegramLinkToken,
  disconnectTelegram,
} from "@/lib/telegram/linking";
import { ratelimit } from "@/lib/upstash";
import { NextResponse } from "next/server";

// GET /api/user/telegram – Telegram connection status of the current user
export const GET = withSession(async ({ session }) => {
  const account = await prisma.telegramAccount.findUnique({
    where: { userId: session.user.id },
    select: { telegramUsername: true, connectedAt: true },
  });

  return NextResponse.json({
    configured: isTelegramConfigured(),
    botUsername: TELEGRAM_BOT_USERNAME ?? null,
    connected: Boolean(account),
    telegramUsername: account?.telegramUsername ?? null,
    connectedAt: account?.connectedAt ?? null,
  });
});

// POST /api/user/telegram – issue a one-time deep link to connect Telegram
export const POST = withSession(async ({ session }) => {
  if (!isTelegramConfigured()) {
    throw new DubApiError({
      code: "forbidden",
      message: "The Telegram bot is not configured yet.",
    });
  }

  const { success } = await ratelimit(5, "10 m").limit(
    `telegram:link-token:${session.user.id}`,
  );
  if (!success) {
    throw new DubApiError({
      code: "rate_limit_exceeded",
      message:
        "Too many connection attempts. Please try again in a few minutes.",
    });
  }

  const { deepLink, expiresAt } = await createTelegramLinkToken(
    session.user.id,
  );

  return NextResponse.json({ deepLink, expiresAt });
});

// DELETE /api/user/telegram – disconnect Telegram
export const DELETE = withSession(async ({ session }) => {
  await disconnectTelegram(session.user.id);
  return NextResponse.json({ connected: false });
});
