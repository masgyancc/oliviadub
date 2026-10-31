import { prisma } from "@/lib/prisma";
import { DubApiError } from "../api/errors";
import { getUserAccess, isMasterAdmin } from "../auth/platform-access";

// BrewCC shared domain pool: every verified, non-archived custom domain can be used by
// every workspace to create links. Settings, deletion and the root link stay with the
// owning workspace; clicks are tracked per link, i.e. per workspace that created the link.

const sharedDomainWhere = {
  projectId: { not: null },
  verified: true,
  archived: false,
} as const;

export async function getSharedDomains({
  excludeWorkspaceId,
}: {
  excludeWorkspaceId?: string;
} = {}) {
  return prisma.domain.findMany({
    where: {
      ...sharedDomainWhere,
      ...(excludeWorkspaceId && { projectId: { not: excludeWorkspaceId } }),
    },
    select: { id: true, slug: true, createdAt: true },
    orderBy: { slug: "asc" },
  });
}

export async function isSharedDomain(slug: string) {
  const domain = await prisma.domain.findFirst({
    where: { slug, ...sharedDomainWhere },
    select: { id: true },
  });
  return Boolean(domain);
}

// Owners can't delete or rename a domain other workspaces have links on (it would break
// their links); master admins can.
export async function assertCanRemoveSharedDomain({
  domain,
  workspaceId,
  userId,
}: {
  domain: string;
  workspaceId: string;
  userId: string;
}) {
  const foreignLinks = await prisma.link.count({
    where: { domain, projectId: { not: workspaceId } },
  });

  if (foreignLinks === 0) {
    return;
  }

  if (isMasterAdmin(await getUserAccess(userId))) {
    return;
  }

  throw new DubApiError({
    code: "forbidden",
    message: `This domain is shared and ${foreignLinks} link(s) from other users depend on it. Only a master admin can delete or rename it.`,
  });
}
