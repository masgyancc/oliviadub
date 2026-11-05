import { DubApiError } from "@/lib/api/errors";
import { getUserAccess } from "@/lib/auth/platform-access";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/upstash/redis";
import { createHash, randomBytes } from "node:crypto";
import { LINK_TOKEN_TTL_SECONDS, TELEGRAM_BOT_USERNAME } from "./config";
import { BotUser, loadWorkspace } from "./context";

// Telegram groups. A BrewCC user (the owner) connects a group to ONE of their workspaces.
// In the group the bot acts as the owner, locked to that workspace. Other group members
// can use it only after the owner approved them. Nothing here can reach another workspace:
// the workspace comes from the group record, never from the chat.

export type GroupMemberStatus = "pending" | "approved";

const tokenKey = (token: string) =>
  `tg:group-token:${createHash("sha256").update(token).digest("hex")}`;

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

type GroupToken = { userId: string; workspaceId: string };

// Deep link that opens Telegram's "add to group" picker and sends /start <token> in the group
export async function createGroupConnectToken({
  userId,
  workspaceId,
}: GroupToken) {
  if (!(await loadWorkspace(userId, workspaceId))) {
    throw new DubApiError({
      code: "forbidden",
      message: "You are not a member of this workspace.",
    });
  }
  const token = randomBytes(32).toString("base64url");
  await redis.set(
    tokenKey(token),
    { userId, workspaceId } satisfies GroupToken,
    {
      ex: LINK_TOKEN_TTL_SECONDS,
    },
  );
  return {
    deepLink: `https://t.me/${TELEGRAM_BOT_USERNAME}?startgroup=${token}`,
    expiresAt: new Date(Date.now() + LINK_TOKEN_TTL_SECONDS * 1000),
  };
}

export type ConnectResult =
  | { ok: true; workspaceName: string }
  | {
      ok: false;
      reason:
        | "invalid"
        | "not_owner"
        | "owner_not_linked"
        | "not_member"
        | "taken";
    };

// Redeemed in the group. Only the user who created the token (identified by their linked
// personal Telegram account) can use it, so a leaked token is useless to anyone else.
export async function connectGroup({
  token,
  chatId,
  title,
  fromTelegramId,
}: {
  token: string;
  chatId: string;
  title?: string;
  fromTelegramId: string;
}): Promise<ConnectResult> {
  if (!TOKEN_FORMAT.test(token)) return { ok: false, reason: "invalid" };

  const data = await redis.getdel<GroupToken>(tokenKey(token));
  if (!data) return { ok: false, reason: "invalid" };

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: data.userId },
    select: { telegramId: true },
  });
  if (!account) return { ok: false, reason: "owner_not_linked" };
  if (account.telegramId !== fromTelegramId) {
    return { ok: false, reason: "not_owner" };
  }

  const loaded = await loadWorkspace(data.userId, data.workspaceId);
  if (!loaded) return { ok: false, reason: "not_member" };

  const existing = await prisma.telegramGroup.findUnique({
    where: { chatId },
  });
  if (existing && existing.ownerUserId !== data.userId) {
    return { ok: false, reason: "taken" };
  }

  if (existing) {
    // the owner moved the group to another workspace: members must be approved again
    if (existing.projectId !== data.workspaceId) {
      await prisma.telegramGroupMember.deleteMany({
        where: { groupId: existing.id },
      });
    }
    await prisma.telegramGroup.update({
      where: { id: existing.id },
      data: { projectId: data.workspaceId, title },
    });
  } else {
    await prisma.telegramGroup.create({
      data: {
        chatId,
        title,
        projectId: data.workspaceId,
        ownerUserId: data.userId,
      },
    });
  }

  await prisma.adminAuditLog.create({
    data: {
      actorId: data.userId,
      action: "telegram.group_connect",
      targetUserId: data.userId,
      toValue: `${title ?? chatId} → ${loaded.workspace.slug}`,
    },
  });

  return { ok: true, workspaceName: loaded.workspace.name };
}

export type GroupAccess =
  | {
      ok: true;
      group: { id: string; chatId: string; projectId: string };
      owner: BotUser;
      isOwner: boolean;
    }
  | { ok: false; reason: "not_connected" | "owner_inactive" }
  | {
      ok: false;
      reason: "not_member" | "pending";
      group: { id: string };
    };

// Checked on EVERY group update, for the Telegram user who sent it or pressed the button
export async function resolveGroupAccess({
  chatId,
  fromTelegramId,
}: {
  chatId: string;
  fromTelegramId: string;
}): Promise<GroupAccess> {
  const group = await prisma.telegramGroup.findUnique({ where: { chatId } });
  if (!group) return { ok: false, reason: "not_connected" };

  // the owner must still be approved and still a member of the workspace
  const [access, owner, loaded, ownerAccount] = await Promise.all([
    getUserAccess(group.ownerUserId),
    prisma.user.findUnique({
      where: { id: group.ownerUserId },
      select: { id: true, name: true, email: true },
    }),
    loadWorkspace(group.ownerUserId, group.projectId),
    prisma.telegramAccount.findUnique({
      where: { userId: group.ownerUserId },
      select: { telegramId: true },
    }),
  ]);
  // disconnecting the owner's personal Telegram also stops their groups
  if (access?.status !== "approved" || !owner || !loaded || !ownerAccount) {
    return { ok: false, reason: "owner_inactive" };
  }

  const groupInfo = {
    id: group.id,
    chatId: group.chatId,
    projectId: group.projectId,
  };

  if (ownerAccount?.telegramId === fromTelegramId) {
    return { ok: true, group: groupInfo, owner, isOwner: true };
  }

  const member = await prisma.telegramGroupMember.findUnique({
    where: {
      groupId_telegramId: { groupId: group.id, telegramId: fromTelegramId },
    },
    select: { status: true },
  });
  if (member?.status === "approved") {
    return { ok: true, group: groupInfo, owner, isOwner: false };
  }
  return {
    ok: false,
    reason: member ? "pending" : "not_member",
    group: { id: group.id },
  };
}

export async function requestGroupAccess({
  groupId,
  telegramId,
  telegramUsername,
  displayName,
}: {
  groupId: string;
  telegramId: string;
  telegramUsername?: string;
  displayName?: string;
}) {
  return prisma.telegramGroupMember.upsert({
    where: { groupId_telegramId: { groupId, telegramId } },
    create: {
      groupId,
      telegramId,
      telegramUsername,
      displayName,
      status: "pending",
    },
    // an existing request (or approval) is kept as it is
    update: { telegramUsername, displayName },
  });
}

// Approve or reject a request. `groupId` comes from the chat the button was pressed in,
// so a member id from another group never matches.
export async function decideGroupMember({
  groupId,
  memberId,
  approve,
}: {
  groupId: string;
  memberId: string;
  approve: boolean;
}) {
  const member = await prisma.telegramGroupMember.findFirst({
    where: { id: memberId, groupId },
  });
  if (!member) return null;

  if (approve) {
    return prisma.telegramGroupMember.update({
      where: { id: member.id },
      data: { status: "approved", approvedAt: new Date() },
    });
  }
  await prisma.telegramGroupMember.delete({ where: { id: member.id } });
  return member;
}

export async function migrateGroupChat(oldChatId: string, newChatId: string) {
  await prisma.telegramGroup.updateMany({
    where: { chatId: oldChatId },
    data: { chatId: newChatId },
  });
}

// ── dashboard (always scoped to the owner) ──

export async function listOwnedGroups(userId: string) {
  const groups = await prisma.telegramGroup.findMany({
    where: { ownerUserId: userId },
    orderBy: { connectedAt: "desc" },
  });
  if (groups.length === 0) return [];

  const [members, workspaces] = await Promise.all([
    prisma.telegramGroupMember.findMany({
      where: { groupId: { in: groups.map((g) => g.id) } },
      orderBy: { requestedAt: "asc" },
    }),
    prisma.project.findMany({
      where: { id: { in: groups.map((g) => g.projectId) } },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return groups.map((g) => ({
    id: g.id,
    title: g.title,
    connectedAt: g.connectedAt,
    workspace: workspaces.find((w) => w.id === g.projectId) ?? null,
    members: members
      .filter((m) => m.groupId === g.id)
      .map((m) => ({
        id: m.id,
        telegramUsername: m.telegramUsername,
        displayName: m.displayName,
        status: m.status as GroupMemberStatus,
        requestedAt: m.requestedAt,
      })),
  }));
}

async function getOwnedGroupOrThrow(userId: string, groupId: string) {
  const group = await prisma.telegramGroup.findFirst({
    where: { id: groupId, ownerUserId: userId },
  });
  if (!group) {
    throw new DubApiError({ code: "not_found", message: "Group not found." });
  }
  return group;
}

export async function disconnectGroup(userId: string, groupId: string) {
  const group = await getOwnedGroupOrThrow(userId, groupId);
  await prisma.$transaction([
    prisma.telegramGroupMember.deleteMany({ where: { groupId: group.id } }),
    prisma.telegramGroup.delete({ where: { id: group.id } }),
    prisma.adminAuditLog.create({
      data: {
        actorId: userId,
        action: "telegram.group_disconnect",
        targetUserId: userId,
        fromValue: group.title ?? group.chatId,
      },
    }),
  ]);
}

export async function updateGroupMember({
  userId,
  groupId,
  memberId,
  action,
}: {
  userId: string;
  groupId: string;
  memberId: string;
  action: "approve" | "remove";
}) {
  const group = await getOwnedGroupOrThrow(userId, groupId);
  const member = await decideGroupMember({
    groupId: group.id,
    memberId,
    approve: action === "approve",
  });
  if (!member) {
    throw new DubApiError({ code: "not_found", message: "Member not found." });
  }
}
