import { beforeEach, describe, expect, test, vi } from "vitest";

// in-memory SavedTrackingPixel / LinkTrackingPixel tables
type Row = Record<string, any>;
const saved: Row[] = [];
const tags: Row[] = [];
let seq = 0;

const matches = (row: Row, where: Row = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && "in" in v) return v.in.includes(row[k]);
    if (v && typeof v === "object" && "not" in v) return row[k] !== v.not;
    return row[k] === v;
  });

const table = (rows: Row[]) => ({
  findMany: vi.fn(async ({ where }: any = {}) =>
    rows.filter((r) => matches(r, where)),
  ),
  findFirst: vi.fn(
    async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null,
  ),
  count: vi.fn(
    async ({ where }: any) => rows.filter((r) => matches(r, where)).length,
  ),
  create: vi.fn(async ({ data }: any) => {
    const row = { id: `id${++seq}`, conversionLabel: "", ...data };
    rows.push(row);
    return row;
  }),
  update: vi.fn(async ({ where, data }: any) => {
    const row = rows.find((r) => r.id === where.id)!;
    Object.assign(row, data);
    return row;
  }),
  updateMany: vi.fn(async ({ where, data }: any) => {
    rows.filter((r) => matches(r, where)).forEach((r) => Object.assign(r, data));
  }),
  delete: vi.fn(async ({ where }: any) => {
    rows.splice(rows.findIndex((r) => r.id === where.id), 1);
  }),
  deleteMany: vi.fn(async ({ where }: any) => {
    for (const r of rows.filter((r) => matches(r, where)))
      rows.splice(rows.indexOf(r), 1);
  }),
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ads-tracking/cache", () => ({
  invalidateTrackingTags: vi.fn(async () => {}),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedTrackingPixel: table(saved),
    linkTrackingPixel: table(tags),
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

const {
  createSavedPixel,
  deleteSavedPixel,
  getLinkSavedPixelIds,
  listSavedPixels,
  setLinkSavedPixels,
} = await import("@/lib/ads-tracking/saved-pixels");

const META = "123456789012345";
const META_2 = "223456789012345";

const save = (userId: string, pixelId = META, workspaceId = "ws1") =>
  createSavedPixel({
    userId,
    workspaceId,
    input: { platform: "meta", pixelId, name: `pixel ${pixelId}` },
  });

beforeEach(() => {
  saved.length = 0;
  tags.length = 0;
});

describe("saved pixels are private to their user", () => {
  test("list only returns the user's own pixels in the workspace", async () => {
    const own = await save("alice");
    await save("bob");
    await save("alice", META_2, "ws2");

    const list = await listSavedPixels("alice", "ws1");
    expect(list.map((p) => p.id)).toEqual([own.id]);
  });

  test("another user can't attach someone else's pixel", async () => {
    const alicePixel = await save("alice");
    await expect(
      setLinkSavedPixels({
        linkId: "link1",
        userId: "bob",
        workspaceId: "ws1",
        savedPixelIds: [alicePixel.id],
      }),
    ).rejects.toThrow("not found");
    expect(tags).toHaveLength(0);
  });

  test("another user can't delete someone else's pixel", async () => {
    const alicePixel = await save("alice");
    await expect(
      deleteSavedPixel({ id: alicePixel.id, userId: "bob", workspaceId: "ws1" }),
    ).rejects.toThrow("not found");
    expect(saved).toHaveLength(1);
  });

  test("rejects invalid pixel ids", async () => {
    await expect(save("alice", "12345")).rejects.toThrow();
  });
});

describe("attaching saved pixels to a link", () => {
  test("one link can use several pixels, and unticking removes only that one", async () => {
    const a = await save("alice");
    const b = await save("alice", META_2);
    const args = { linkId: "link1", userId: "alice", workspaceId: "ws1" };

    await setLinkSavedPixels({ ...args, savedPixelIds: [a.id, b.id] });
    expect(tags.map((t) => t.pixelId).sort()).toEqual([META, META_2]);
    expect(await getLinkSavedPixelIds(args)).toEqual([a.id, b.id]);

    await setLinkSavedPixels({ ...args, savedPixelIds: [b.id] });
    expect(tags.map((t) => t.pixelId)).toEqual([META_2]);
  });

  test("hand-entered tags and other users' picks are left alone", async () => {
    const a = await save("alice");
    const bobPixel = await save("bob", META_2);
    tags.push({
      id: "manual",
      linkId: "link1",
      projectId: "ws1",
      platform: "tiktok",
      pixelId: "C4ABCDEFGHIJ1234567K",
      conversionLabel: "",
      savedPixelId: null,
    });
    await setLinkSavedPixels({
      linkId: "link1",
      userId: "bob",
      workspaceId: "ws1",
      savedPixelIds: [bobPixel.id],
    });

    await setLinkSavedPixels({
      linkId: "link1",
      userId: "alice",
      workspaceId: "ws1",
      savedPixelIds: [a.id],
    });
    await setLinkSavedPixels({
      linkId: "link1",
      userId: "alice",
      workspaceId: "ws1",
      savedPixelIds: [],
    });

    expect(tags.map((t) => t.id)).toContain("manual");
    expect(tags.some((t) => t.savedPixelId === bobPixel.id)).toBe(true);
    expect(tags.some((t) => t.savedPixelId === a.id)).toBe(false);
  });

  test("deleting a saved pixel keeps it firing on links that use it", async () => {
    const a = await save("alice");
    await setLinkSavedPixels({
      linkId: "link1",
      userId: "alice",
      workspaceId: "ws1",
      savedPixelIds: [a.id],
    });

    await deleteSavedPixel({ id: a.id, userId: "alice", workspaceId: "ws1" });

    expect(saved).toHaveLength(0);
    expect(tags).toHaveLength(1);
    expect(tags[0].savedPixelId).toBeNull();
  });
});
