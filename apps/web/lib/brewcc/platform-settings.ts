import { prisma } from "@/lib/prisma";
import { DubApiError } from "../api/errors";
import { getUserAccess, isMasterAdmin } from "../auth/platform-access";

// BrewCC global settings, stored in PlatformSetting and read straight from the database
// on every check (they gate rare actions), so a change applies immediately on every instance.

export const ALLOW_USER_DOMAINS_KEY = "allowUserDomains";

export const ADD_DOMAIN_DISABLED_MESSAGE =
  "Custom domain registration is currently disabled by administrator.";

// default OFF: a missing row means users can't add domains
export async function getAllowUserDomains() {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: ALLOW_USER_DOMAINS_KEY },
    select: { value: true },
  });
  return setting?.value === "true";
}

export async function setAllowUserDomains(value: boolean, adminId: string) {
  await prisma.platformSetting.upsert({
    where: { key: ALLOW_USER_DOMAINS_KEY },
    create: {
      key: ALLOW_USER_DOMAINS_KEY,
      value: String(value),
      updatedById: adminId,
    },
    update: { value: String(value), updatedById: adminId },
  });
}

// master admins can always add domains; everyone else only while the setting is ON
export async function canAddDomains(userId: string) {
  if (isMasterAdmin(await getUserAccess(userId))) {
    return true;
  }
  return getAllowUserDomains();
}

// server-side gate for every endpoint that adds a domain to a workspace
export async function assertCanAddDomains(userId: string) {
  if (!(await canAddDomains(userId))) {
    throw new DubApiError({
      code: "forbidden",
      message: ADD_DOMAIN_DISABLED_MESSAGE,
    });
  }
}
