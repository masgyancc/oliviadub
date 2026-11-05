import { describe, expect, test, vi } from "vitest";

const getAnalytics = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/analytics/get-analytics", () => ({ getAnalytics }));

const { getBreakdown } = await import("@/lib/telegram/analytics");

const workspace = { id: "ws1", createdAt: new Date("2026-10-30") } as any;

describe("telegram analytics breakdown", () => {
  test("regions: top 5 by clicks with region and country names", async () => {
    getAnalytics.mockResolvedValueOnce([
      { country: "ID", region: "ID-JW", clicks: 3 },
      { country: "ID", region: "ID-KA", clicks: 9 },
      { country: "MY", region: "MY-XX", clicks: 1 },
      { country: "SG", region: "SG-01", clicks: 0 },
    ]);

    const rows = await getBreakdown({ workspace, groupBy: "regions" });

    expect(rows).toEqual([
      { label: "Kalimantan, Indonesia", clicks: 9 },
      { label: "Jawa, Indonesia", clicks: 3 },
      { label: "MY-XX, Malaysia", clicks: 1 },
    ]);
    expect(getAnalytics.mock.calls[0][0]).toMatchObject({
      groupBy: "regions",
      workspaceId: "ws1",
    });
  });

  test("devices: scoped to the link when a linkId is given", async () => {
    getAnalytics.mockResolvedValueOnce([
      { device: "Mobile", clicks: 7 },
      { device: "Desktop", clicks: 2 },
    ]);

    const rows = await getBreakdown({
      workspace,
      linkId: "link_1",
      groupBy: "devices",
    });

    expect(rows).toEqual([
      { label: "Mobile", clicks: 7 },
      { label: "Desktop", clicks: 2 },
    ]);
    expect(getAnalytics.mock.calls[1][0].linkId).toBeTruthy();
  });
});
