import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AdminUserRow } from "./users-table";

// callers are admin pages, already protected by the admin layout
export async function getAdminUsers(
  where: Prisma.UserWhereInput,
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

  return users.map(({ _count, ...u }) => ({
    ...u,
    workspaces: _count.projects,
  }));
}
