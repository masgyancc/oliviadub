import { prismaEdge } from "@/lib/prisma/edge";
import { redis } from "@/lib/upstash/redis";
import { AccountStatus, PlatformRole } from "@prisma/client";
import { DubApiError } from "../api/errors";

// BrewCC platform access: a user's platform role and approval status.
// Usable from middleware (prismaEdge) as well as route handlers and server actions.

export interface UserAccess {
  platformRole: PlatformRole;
  status: AccountStatus;
}

const CACHE_TTL_SECONDS = 60;
const cacheKey = (userId: string) => `brewcc:user-access:${userId}`;

export async function getUserAccess(
  userId: string,
): Promise<UserAccess | null> {
  try {
    const cached = await redis.get<UserAccess>(cacheKey(userId));
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.error("[getUserAccess] cache read failed", error);
  }

  const user = await prismaEdge.user.findUnique({
    where: { id: userId },
    select: { platformRole: true, status: true },
  });

  if (!user) {
    return null;
  }

  try {
    await redis.set(cacheKey(userId), user, { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.error("[getUserAccess] cache write failed", error);
  }

  return user;
}

export async function invalidateUserAccess(userId: string) {
  try {
    await redis.del(cacheKey(userId));
  } catch (error) {
    console.error("[invalidateUserAccess] failed", error);
  }
}

export const isApproved = (access: UserAccess | null) =>
  access?.status === "approved";

export const isMasterAdmin = (access: UserAccess | null) =>
  access?.platformRole === "master_admin" && access.status === "approved";

const STATUS_MESSAGES: Record<Exclude<AccountStatus, "approved">, string> = {
  pending: "Your account is awaiting approval by an administrator.",
  rejected: "Your account registration was not approved.",
  suspended: "Your account has been suspended.",
};

// Throws unless the user is approved. Used by every operational API route and server action.
export async function assertUserApproved(userId: string) {
  const access = await getUserAccess(userId);

  if (!access) {
    throw new DubApiError({
      code: "unauthorized",
      message: "Unauthorized: User not found.",
    });
  }

  if (access.status !== "approved") {
    throw new DubApiError({
      code: "forbidden",
      message: STATUS_MESSAGES[access.status],
    });
  }

  return access;
}

export async function assertMasterAdmin(userId: string) {
  const access = await getUserAccess(userId);

  if (!isMasterAdmin(access)) {
    throw new DubApiError({
      code: "forbidden",
      message: "Unauthorized: Master admin access required.",
    });
  }

  return access!;
}
