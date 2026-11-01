import { beforeEach, describe, expect, test, vi } from "vitest";

// in-memory PlatformSetting table and platform roles
const settings = new Map<string, string>();
const roles: Record<string, string> = {
  admin: "master_admin",
  user: "user",
};

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformSetting: {
      findUnique: vi.fn(async ({ where }) =>
        settings.has(where.key) ? { value: settings.get(where.key) } : null,
      ),
      upsert: vi.fn(async ({ where, create, update }) => {
        settings.set(
          where.key,
          settings.has(where.key) ? update.value : create.value,
        );
      }),
    },
  },
}));

vi.mock("@/lib/auth/platform-access", () => ({
  getUserAccess: vi.fn(async (userId: string) => ({
    platformRole: roles[userId],
    status: "approved",
  })),
  isMasterAdmin: (access: any) =>
    access?.platformRole === "master_admin" && access.status === "approved",
}));

const {
  ADD_DOMAIN_DISABLED_MESSAGE,
  assertCanAddDomains,
  canAddDomains,
  getAllowUserDomains,
  setAllowUserDomains,
} = await import("@/lib/brewcc/platform-settings");

beforeEach(() => settings.clear());

describe("Allow Users to Add Domains", () => {
  test("defaults to OFF when nothing is stored", async () => {
    expect(await getAllowUserDomains()).toBe(false);
  });

  test("OFF blocks users with the administrator message (API gate)", async () => {
    expect(await canAddDomains("user")).toBe(false);
    await expect(assertCanAddDomains("user")).rejects.toThrow(
      ADD_DOMAIN_DISABLED_MESSAGE,
    );
  });

  test("master admins can always add domains, even when OFF", async () => {
    expect(await canAddDomains("admin")).toBe(true);
    await expect(assertCanAddDomains("admin")).resolves.toBeUndefined();
  });

  test("ON allows users, and the value is persisted (survives restarts)", async () => {
    await setAllowUserDomains(true, "admin");
    expect(settings.get("allowUserDomains")).toBe("true");
    expect(await canAddDomains("user")).toBe(true);

    await setAllowUserDomains(false, "admin");
    expect(await canAddDomains("user")).toBe(false);
  });
});
