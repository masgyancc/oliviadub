import { Prisma } from "@prisma/client";

// BrewCC is self-hosted for internal use, so every approved user's workspace runs on the
// enterprise plan with effectively unlimited limits (same values as the original master workspaces).
export const BREWCC_ENTERPRISE_PLAN = {
  plan: "enterprise",
  planTier: 1,
  usageLimit: 1_000_000_000,
  linksLimit: 1_000_000_000,
  domainsLimit: 1000,
  tagsLimit: 1_000_000,
  foldersLimit: 1_000_000,
  usersLimit: 1000,
  aiLimit: 1_000_000,
  trialEndsAt: null,
} satisfies Prisma.ProjectUpdateInput;

// Upgrades every workspace the user owns (used when an account is approved/reactivated).
export async function upgradeOwnedWorkspacesToEnterprise(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  return tx.project.updateMany({
    where: {
      users: { some: { userId, role: "owner" } },
      plan: { not: "enterprise" },
    },
    data: BREWCC_ENTERPRISE_PLAN,
  });
}
