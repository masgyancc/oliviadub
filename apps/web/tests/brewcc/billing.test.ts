import {
  AppUsage,
  computeBill,
  emptyCosts,
  MonthCosts,
  previousMonth,
} from "@/lib/brewcc/billing";
import { describe, expect, test } from "vitest";

const costs = (): MonthCosts => {
  const c = emptyCosts();
  c.vercel = 20; // 10 each
  c.apps.brewcc.planetscale = 39;
  c.apps.brewcc.upstash = 1;
  c.apps.brewads.planetscale = 47;
  c.apps.brewads.upstash = 3;
  return c;
};

const ws = (slug: string, clicks: number) => ({ slug, name: slug, clicks });

const brewcc: AppUsage = {
  app: "brewcc",
  users: [
    {
      email: "Budi@x.com",
      name: "Budi",
      clicks: 750,
      workspaces: [ws("budi-cc", 750)],
    },
    {
      email: "sari@x.com",
      name: "Sari",
      clicks: 250,
      workspaces: [ws("sari-cc", 250)],
    },
  ],
};
const brewads: AppUsage = {
  app: "brewads",
  users: [
    {
      email: "budi@x.com",
      name: "Budi",
      clicks: 600,
      workspaces: [ws("a", 400), ws("b", 200)],
    },
    {
      email: "rina@x.com",
      name: null,
      clicks: 400,
      workspaces: [ws("rina", 400)],
    },
  ],
};

describe("shared bill", () => {
  test("Vercel is split 50:50, then each app by clicks", () => {
    const bill = computeBill(costs(), [brewcc, brewads]);
    expect(bill.pools).toEqual({ brewcc: 50, brewads: 60 });
    expect(bill.totalCost).toBe(110);

    const budi = bill.users.find((u) => u.email === "budi@x.com")!;
    expect(budi.apps.brewcc!.amount).toBe(37.5); // 75% of 50
    expect(budi.apps.brewads!.amount).toBe(36); // 60% of 60
    expect(budi.total).toBe(73.5);
    expect(budi.apps.brewads!.workspaces).toHaveLength(2);
  });

  test("one bill per person across both apps (matched by email)", () => {
    const bill = computeBill(costs(), [brewcc, brewads]);
    expect(bill.users.map((u) => u.email)).toEqual([
      "budi@x.com",
      "rina@x.com",
      "sari@x.com",
    ]);
    expect(
      bill.users.find((u) => u.email === "sari@x.com")!.apps.brewads,
    ).toBeUndefined();
  });

  test("everything adds up to the total cost, to the cent", () => {
    const c = emptyCosts();
    c.vercel = 33.33;
    c.apps.brewcc.other = 10;
    c.apps.brewads.other = 7.01;
    const three: AppUsage = {
      app: "brewads",
      users: ["a", "b", "c"].map((e) => ({
        email: `${e}@x.com`,
        name: null,
        clicks: 1,
        workspaces: [],
      })),
    };
    const one: AppUsage = {
      app: "brewcc",
      users: [{ email: "a@x.com", name: null, clicks: 3, workspaces: [] }],
    };
    const bill = computeBill(c, [one, three]);
    const billed = bill.users.reduce(
      (s, u) => s + Math.round(u.total * 100),
      0,
    );
    expect(billed).toBe(Math.round(bill.totalCost * 100));
  });

  test("an app without clicks keeps its costs as not split", () => {
    const bill = computeBill(costs(), [brewcc]);
    expect(bill.unassigned).toEqual({ brewcc: 0, brewads: 60 });
    expect(bill.users).toHaveLength(2);
  });

  test("previous month", () => {
    expect(previousMonth("2026-11")).toBe("2026-10");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});
