import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AdminUserRow } from "./users-table";

// callers are admin pages, already protected by the admin layout.
// `viewerId` is the session admin: only their own private aliases are attached.
export async function getAdminUsers(
  where: Prisma.UserWhereInput,
  viewerId: string,
  take = 200,
): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    where: { isMachine: false, ...where },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      status: true,
      platformRole: true,
      statusReason: true,
      _count: { select: { projects: true } },
    },
  });

  const aliases = await prisma.adminUserAlias.findMany({
    where: { adminId: viewerId, userId: { in: users.map((u) => u.id) } },
    select: { userId: true, alias: true },
  });
  const aliasByUser = new Map(aliases.map((a) => [a.userId, a.alias]));

  return users.map(({ _count, ...u }) => ({
    ...u,
    workspaces: _count.projects,
    alias: aliasByUser.get(u.id) ?? null,
  }));
}
