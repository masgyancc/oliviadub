import { beforeEach, describe, expect, test, vi } from "vitest";

// in-memory tables
type Row = Record<string, any>;
const groups: Row[] = [];
const members: Row[] = [];
const accounts: Row[] = [
  { userId: "owner", telegramId: "100" },
  { userId: "other", telegramId: "200" },
];
const memberships: Record<string, string[]> = {
  owner: ["wsA", "wsB"],
  other: ["wsC"],
};
const statuses: Record<string, string> = {
  owner: "approved",
  other: "approved",
};
const redisStore = new Map<string, unknown>();
let seq = 0;

const where = (row: Row, w: Row = {}) =>
  Object.entries(w).every(([k, v]) =>
    k === "groupId_telegramId"
      ? row.groupId === v.groupId && row.telegramId === v.telegramId
      : v && typeof v === "object" && "in" in v
        ? v.in.includes(row[k])
        : row[k] === v,
  );

const table = (rows: Row[]) => ({
  findUnique: vi.fn(
    async ({ where: w }: any) => rows.find((r) => where(r, w)) ?? null,
  ),
  findFirst: vi.fn(
    async ({ where: w }: any) => rows.find((r) => where(r, w)) ?? null,
  ),
  findMany: vi.fn(async ({ where: w }: any = {}) =>
    rows.filter((r) => where(r, w)),
  ),
  create: vi.fn(async ({ data }: any) => {
    const row = { id: `id${++seq}`, connectedAt: new Date(), ...data };
    rows.push(row);
    return row;
  }),
  update: vi.fn(async ({ where: w, data }: any) =>
    Object.assign(rows.find((r) => where(r, w))!, data),
  ),
  updateMany: vi.fn(async ({ where: w, data }: any) => {
    rows.filter((r) => where(r, w)).forEach((r) => Object.assign(r, data));
  }),
  upsert: vi.fn(async ({ where: w, create, update }: any) => {
    const found = rows.find((r) => where(r, w));
    if (found) return Object.assign(found, update);
    const row = { id: `id${++seq}`, ...create };
    rows.push(row);
    return row;
  }),
  delete: vi.fn(async ({ where: w }: any) => {
    rows.splice(
      rows.findIndex((r) => where(r, w)),
      1,
    );
  }),
  deleteMany: vi.fn(async ({ where: w }: any) => {
    for (const r of rows.filter((r) => where(r, w)))
      rows.splice(rows.indexOf(r), 1);
  }),
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/upstash/redis", () => ({
  redis: {
    set: vi.fn(async (k: string, v: unknown) => redisStore.set(k, v)),
    getdel: vi.fn(async (k: string) => {
      const v = redisStore.get(k) ?? null;
      redisStore.delete(k);
      return v;
    }),
  },
}));
vi.mock("@/lib/auth/platform-access", () => ({
  getUserAccess: vi.fn(async (userId: string) => ({
    status: statuses[userId],
  })),
}));
vi.mock("@/lib/telegram/context", () => ({
  loadWorkspace: vi.fn(async (userId: string, workspaceId: string) =>
    memberships[userId]?.includes(workspaceId)
      ? {
          workspace: { id: workspaceId, slug: workspaceId, name: workspaceId },
          permissions: [],
        }
      : null,
  ),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    telegramGroup: table(groups),
    telegramGroupMember: table(members),
    telegramAccount: table(accounts),
    user: {
      findUnique: vi.fn(async ({ where: w }: any) => ({
        id: w.id,
        name: w.id,
        email: null,
      })),
    },
    project: { findMany: vi.fn(async () => []) },
    adminAuditLog: { create: vi.fn(async () => ({})) },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

const groupsLib = await import("@/lib/telegram/groups");

const tokenOf = (deepLink: string) => deepLink.split("startgroup=")[1];

async function connect(
  userId: string,
  workspaceId: string,
  from: string,
  chatId = "-1",
) {
  const { deepLink } = await groupsLib.createGroupConnectToken({
    userId,
    workspaceId,
  });
  return groupsLib.connectGroup({
    token: tokenOf(deepLink),
    chatId,
    title: "Team",
    fromTelegramId: from,
  });
}

beforeEach(() => {
  groups.length = 0;
  members.length = 0;
  redisStore.clear();
  statuses.owner = "approved";
});

describe("connecting a group", () => {
  test("only the token's owner (by their linked Telegram) can use it, once", async () => {
    const { deepLink } = await groupsLib.createGroupConnectToken({
      userId: "owner",
      workspaceId: "wsA",
    });
    const token = tokenOf(deepLink);

    expect(
      await groupsLib.connectGroup({
        token,
        chatId: "-1",
        fromTelegramId: "200",
      }),
    ).toEqual({ ok: false, reason: "not_owner" });
    // the token is single-use even after a failed attempt
    expect(
      await groupsLib.connectGroup({
        token,
        chatId: "-1",
        fromTelegramId: "100",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  test("a user can't issue a token for a workspace they don't belong to", async () => {
    await expect(
      groupsLib.createGroupConnectToken({
        userId: "other",
        workspaceId: "wsA",
      }),
    ).rejects.toThrow();
  });

  test("a group connected by one user can't be taken over by another", async () => {
    expect((await connect("owner", "wsA", "100")).ok).toBe(true);
    expect(await connect("other", "wsC", "200")).toEqual({
      ok: false,
      reason: "taken",
    });
    expect(groups[0]).toMatchObject({ ownerUserId: "owner", projectId: "wsA" });
  });

  test("moving the group to another workspace resets its members", async () => {
    await connect("owner", "wsA", "100");
    members.push({
      id: "m1",
      groupId: groups[0].id,
      telegramId: "300",
      status: "approved",
    });
    await connect("owner", "wsB", "100");
    expect(groups[0].projectId).toBe("wsB");
    expect(members).toHaveLength(0);
  });
});

describe("access in a group", () => {
  test("owner and approved members get access to the group's workspace only", async () => {
    await connect("owner", "wsA", "100");
    const gid = groups[0].id;

    const owner = await groupsLib.resolveGroupAccess({
      chatId: "-1",
      fromTelegramId: "100",
    });
    expect(owner).toMatchObject({
      ok: true,
      isOwner: true,
      group: { projectId: "wsA" },
    });

    expect(
      await groupsLib.resolveGroupAccess({
        chatId: "-1",
        fromTelegramId: "300",
      }),
    ).toMatchObject({ ok: false, reason: "not_member" });

    const req = await groupsLib.requestGroupAccess({
      groupId: gid,
      telegramId: "300",
    });
    expect(
      await groupsLib.resolveGroupAccess({
        chatId: "-1",
        fromTelegramId: "300",
      }),
    ).toMatchObject({ ok: false, reason: "pending" });

    await groupsLib.decideGroupMember({
      groupId: gid,
      memberId: req.id,
      approve: true,
    });
    expect(
      await groupsLib.resolveGroupAccess({
        chatId: "-1",
        fromTelegramId: "300",
      }),
    ).toMatchObject({ ok: true, isOwner: false, owner: { id: "owner" } });
  });

  test("a member id from another group can't be approved here", async () => {
    await connect("owner", "wsA", "100", "-1");
    await connect("owner", "wsB", "100", "-2");
    const req = await groupsLib.requestGroupAccess({
      groupId: groups[1].id,
      telegramId: "300",
    });
    expect(
      await groupsLib.decideGroupMember({
        groupId: groups[0].id,
        memberId: req.id,
        approve: true,
      }),
    ).toBeNull();
    expect(members[0].status).toBe("pending");
  });

  test("the group stops when its owner is suspended", async () => {
    await connect("owner", "wsA", "100");
    statuses.owner = "suspended";
    expect(
      await groupsLib.resolveGroupAccess({
        chatId: "-1",
        fromTelegramId: "100",
      }),
    ).toEqual({ ok: false, reason: "owner_inactive" });
  });

  test("unconnected groups get nothing", async () => {
    expect(
      await groupsLib.resolveGroupAccess({
        chatId: "-9",
        fromTelegramId: "100",
      }),
    ).toEqual({ ok: false, reason: "not_connected" });
  });
});

describe("dashboard management", () => {
  test("users can only disconnect their own groups", async () => {
    await connect("owner", "wsA", "100");
    await expect(
      groupsLib.disconnectGroup("other", groups[0].id),
    ).rejects.toThrow();
    expect(groups).toHaveLength(1);
    await groupsLib.disconnectGroup("owner", groups[0].id);
    expect(groups).toHaveLength(0);
  });
});
