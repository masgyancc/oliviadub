import { beforeEach, describe, expect, test, vi } from "vitest";

// in-memory links: two users in two workspaces with the same destination domain
const links = [
  {
    id: "a1",
    projectId: "ws_a",
    userId: "user_a",
    key: "x",
    url: "https://old.com/#layanan",
  },
  {
    id: "a2",
    projectId: "ws_a",
    userId: "user_a",
    key: "y",
    url: "https://www.old.com/lokasi?ref=ig",
  },
  {
    id: "a3",
    projectId: "ws_a",
    userId: "user_a",
    key: "z",
    url: "https://other.com/old.com",
  },
  {
    id: "a4",
    projectId: "ws_a",
    userId: "user_teammate",
    key: "t",
    url: "https://old.com/t",
  },
  {
    id: "b1",
    projectId: "ws_b",
    userId: "user_b",
    key: "x",
    url: "https://old.com/#layanan",
  },
];

const matches = (link: any, where: any) =>
  (!where.projectId || link.projectId === where.projectId) &&
  (!where.userId || link.userId === where.userId) &&
  (!where.id?.in || where.id.in.includes(link.id)) &&
  (!where.key?.not || link.key !== where.key.not) &&
  (!where.url?.contains || link.url.includes(where.url.contains));

const findManyCalls: any[] = [];
const updateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    link: {
      count: vi.fn(
        async ({ where }) => links.filter((l) => matches(l, where)).length,
      ),
      findMany: vi.fn(async ({ where }) => {
        findManyCalls.push(where);
        return links
          .filter((l) => matches(l, where))
          .map((l) => ({
            ...l,
            shortLink: `https://s.co/${l.key}`,
            ios: null,
            android: null,
            geo: null,
            testVariants: null,
          }));
      }),
    },
    linkUrlReplacement: {
      createMany: vi.fn(),
      findMany: vi.fn(async () => []),
    },
    adminAuditLog: { create: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/telegram/links", () => ({
  updateLinkFromBot: (args: any) => updateMock(args),
}));

const { previewReplacement, applyReplacement } = await import(
  "@/lib/bulk-replace/service"
);

const wsA = { id: "ws_a" } as any;

beforeEach(() => {
  findManyCalls.length = 0;
  updateMock.mockReset();
  updateMock.mockResolvedValue({});
});

describe("bulk replace service – ownership", () => {
  test("preview only sees links the session user created in the current workspace", async () => {
    const res = await previewReplacement({
      workspace: wsA,
      userId: "user_a",
      oldDomain: "old.com",
      newDomain: "new.com",
    });
    expect(res.checked).toBe(3); // a1, a2, a3 (not the teammate's a4, not user_b's b1)
    expect(res.items.map((i) => i.linkId).sort()).toEqual(["a1", "a2"]);
    expect(res.items.find((i) => i.linkId === "a2")?.newUrl).toBe(
      "https://new.com/lokasi?ref=ig",
    );
    for (const where of findManyCalls) {
      expect(where).toMatchObject({ projectId: "ws_a", userId: "user_a" });
    }
  });

  test("ids of other users' links in the request are ignored (12, 13)", async () => {
    const res = await applyReplacement({
      workspace: wsA,
      userId: "user_a",
      oldDomain: "old.com",
      newDomain: "new.com",
      items: [
        { linkId: "a1", expectedUrl: "https://old.com/#layanan" },
        { linkId: "b1", expectedUrl: "https://old.com/#layanan" }, // user_b's link
        { linkId: "a4", expectedUrl: "https://old.com/t" }, // teammate's link
      ],
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).toMatchObject({
      linkId: "a1",
      userId: "user_a",
      changes: { url: "https://new.com/#layanan" },
    });
    expect(res).toMatchObject({ updated: 1, skipped: 2, failed: 0 });
  });

  test("a master admin is scoped exactly like everyone else (16)", async () => {
    // the service has no role parameter: admins get the same userId + workspace filter
    await applyReplacement({
      workspace: wsA,
      userId: "user_a",
      oldDomain: "old.com",
      newDomain: "new.com",
      items: [{ linkId: "b1", expectedUrl: "https://old.com/#layanan" }],
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  test("links changed after the preview are skipped (14)", async () => {
    const res = await applyReplacement({
      workspace: wsA,
      userId: "user_a",
      oldDomain: "old.com",
      newDomain: "new.com",
      items: [{ linkId: "a1", expectedUrl: "https://old.com/#previous-value" }],
    });
    expect(updateMock).not.toHaveBeenCalled();
    expect(res).toMatchObject({ updated: 0, skipped: 1 });
  });

  test("partial failure is reported and doesn't stop other links (15)", async () => {
    updateMock.mockImplementation(async ({ linkId }) => {
      if (linkId === "a2") throw new Error("boom");
      return {};
    });
    const res = await applyReplacement({
      workspace: wsA,
      userId: "user_a",
      oldDomain: "old.com",
      newDomain: "new.com",
      items: [
        { linkId: "a1", expectedUrl: "https://old.com/#layanan" },
        { linkId: "a2", expectedUrl: "https://www.old.com/lokasi?ref=ig" },
      ],
    });
    expect(res).toMatchObject({ matched: 2, updated: 1, failed: 1 });
  });

  test("invalid or identical domains are rejected before touching data", async () => {
    await expect(
      previewReplacement({
        workspace: wsA,
        userId: "user_a",
        oldDomain: "old.com/x",
        newDomain: "new.com",
      }),
    ).rejects.toThrow();
    await expect(
      previewReplacement({
        workspace: wsA,
        userId: "user_a",
        oldDomain: "old.com",
        newDomain: "https://www.old.com",
      }),
    ).rejects.toThrow(/same/);
  });
});
