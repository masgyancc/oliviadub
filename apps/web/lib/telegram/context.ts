import {
  getPermissionsByRole,
  PermissionAction,
} from "@/lib/api/rbac/permissions";
import { getUserAccess } from "@/lib/auth/platform-access";
import { prisma } from "@/lib/prisma";
import { WorkspaceWithUsers } from "@/lib/types";
import { waitUntil } from "@vercel/functions";

// Resolves who is talking to the bot. Runs on EVERY update: the Telegram user id must be
// linked to a BrewCC account and that account must currently be approved.

export type BotUser = { id: string; name: string | null; email: string | null };

export type ResolveResult =
  | { ok: true; user: BotUser }
  | {
      ok: false;
      reason: "unlinked" | "pending" | "rejected" | "suspended" | "missing";
    };

export async function resolveBotUser(
  telegramId: string,
): Promise<ResolveResult> {
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId },
    select: { id: true, userId: true },
  });
  if (!account) return { ok: false, reason: "unlinked" };

  const access = await getUserAccess(account.userId);
  if (!access) return { ok: false, reason: "missing" };
  if (access.status !== "approved") return { ok: false, reason: access.status };

  const user = await prisma.user.findUnique({
    where: { id: account.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { ok: false, reason: "missing" };

  waitUntil(
    prisma.telegramAccount
      .update({
        where: { id: account.id },
        data: { lastInteractionAt: new Date() },
      })
      .catch(() => {}),
  );

  return { ok: true, user };
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.projectUsers.findMany({
    where: { userId },
    select: { project: { select: { id: true, slug: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => m.project);
}

// Same workspace shape and role → permission mapping as withWorkspace (lib/auth/workspace.ts)
export async function loadWorkspace(userId: string, workspaceId: string) {
  const workspace = (await prisma.project.findUnique({
    where: { id: workspaceId },
    include: {
      users: {
        where: { userId },
        select: {
          role: true,
          defaultFolderId: true,
          workspacePreferences: true,
        },
      },
    },
  })) as WorkspaceWithUsers | null;

  if (!workspace || workspace.users.length === 0) return null;

  return {
    workspace,
    permissions: getPermissionsByRole(workspace.users[0].role),
  };
}

export const can = (
  permissions: PermissionAction[],
  action: PermissionAction,
) => permissions.includes(action);
