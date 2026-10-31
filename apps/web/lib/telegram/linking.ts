import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "node:crypto";
import { LINK_TOKEN_TTL_SECONDS, TELEGRAM_BOT_USERNAME } from "./config";

// Account linking: the dashboard issues a one-time token, the bot redeems it via /start <token>.
// Only the SHA-256 hash of the token is stored; tokens expire after 5 minutes and can be used once.

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// Telegram deep-link payloads allow [A-Za-z0-9_-], max 64 chars; 32 random bytes → 43 chars
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export async function createTelegramLinkToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_SECONDS * 1000);

  await prisma.$transaction([
    // only the newest token of a user stays valid
    prisma.telegramLinkToken.deleteMany({
      where: { userId, usedAt: null },
    }),
    prisma.telegramLinkToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    }),
  ]);

  return {
    deepLink: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`,
    expiresAt,
  };
}

export type RedeemResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      reason:
        | "invalid"
        | "expired"
        | "used"
        | "telegram_taken"
        | "not_approved";
    };

export async function redeemTelegramLinkToken({
  token,
  telegramId,
  telegramUsername,
}: {
  token: string;
  telegramId: string;
  telegramUsername?: string;
}): Promise<RedeemResult> {
  if (!TOKEN_FORMAT.test(token)) {
    return { ok: false, reason: "invalid" };
  }

  return prisma.$transaction(async (tx) => {
    const record = await tx.telegramLinkToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record) return { ok: false, reason: "invalid" } as const;
    if (record.usedAt) return { ok: false, reason: "used" } as const;
    if (record.expiresAt < new Date())
      return { ok: false, reason: "expired" } as const;

    // mark used first: a concurrent redeem of the same token updates 0 rows and fails
    const claimed = await tx.telegramLinkToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return { ok: false, reason: "used" } as const;

    const user = await tx.user.findUnique({
      where: { id: record.userId },
      select: { status: true },
    });
    if (user?.status !== "approved") {
      return { ok: false, reason: "not_approved" } as const;
    }

    const existing = await tx.telegramAccount.findUnique({
      where: { telegramId },
      select: { userId: true },
    });
    if (existing && existing.userId !== record.userId) {
      return { ok: false, reason: "telegram_taken" } as const;
    }

    await tx.telegramAccount.upsert({
      where: { userId: record.userId },
      create: { userId: record.userId, telegramId, telegramUsername },
      update: {
        telegramId,
        telegramUsername,
        connectedAt: new Date(),
      },
    });

    await tx.adminAuditLog.create({
      data: {
        actorId: record.userId,
        action: "telegram.connect",
        targetUserId: record.userId,
        toValue: telegramUsername ? `@${telegramUsername}` : telegramId,
      },
    });

    return { ok: true, userId: record.userId } as const;
  });
}

export async function disconnectTelegram(userId: string) {
  const account = await prisma.telegramAccount.findUnique({
    where: { userId },
  });
  if (!account) return false;

  await prisma.$transaction([
    prisma.telegramAccount.delete({ where: { userId } }),
    prisma.telegramLinkToken.deleteMany({ where: { userId } }),
    prisma.adminAuditLog.create({
      data: {
        actorId: userId,
        action: "telegram.disconnect",
        targetUserId: userId,
        fromValue: account.telegramUsername
          ? `@${account.telegramUsername}`
          : account.telegramId,
      },
    }),
  ]);
  return true;
}
