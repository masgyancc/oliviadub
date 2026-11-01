import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";

// one valid link on the custom domain; everything else does not exist
vi.mock("server-only", () => ({}));

vi.mock("@/lib/axiom/server", () => ({
  logger: { info: vi.fn(), flush: vi.fn(async () => {}) },
}));
vi.mock("@axiomhq/nextjs", () => ({
  transformMiddlewareRequest: () => ["request"],
}));

vi.mock("@/lib/middleware/app", () => ({
  AppMiddleware: vi.fn(() => new Response("app", { status: 200 })),
}));
vi.mock("@/lib/middleware/api", () => ({
  ApiMiddleware: vi.fn(() => new Response("api", { status: 200 })),
}));

vi.mock("@/lib/api/links/cache", () => ({
  linkCache: {
    get: vi.fn(async () => ({ cachedLink: null, redisFailOver: false })),
    set: vi.fn(async () => {}),
    _createStaticPagesCacheKeys: () => "tag",
  },
}));
vi.mock("@/lib/planetscale", () => ({
  getLinkViaEdge: vi.fn(async ({ key }) =>
    key === "abc123" ? { id: "link_1", url: "https://example.com/x" } : null,
  ),
}));
vi.mock("@/lib/upstash", () => ({
  formatRedisLink: (l: any) => ({ ...l, projectId: "ws_a" }),
}));
vi.mock("@/lib/tinybird", () => ({ recordClick: vi.fn(async () => {}) }));
vi.mock("@/lib/ads-tracking/cache", () => ({
  getActiveTrackingTags: vi.fn(async () => []),
}));
vi.mock("@/lib/api/links/record-click-cache", () => ({
  recordClickCache: { get: vi.fn(async () => null) },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@vercel/functions", () => ({ geolocation: () => ({}) }));

const { default: middleware } = await import("../../middleware");

const ev = { waitUntil: () => {} } as any;
const visit = (url: string) =>
  middleware(
    new NextRequest(url, { headers: { host: new URL(url).host } }),
    ev,
  );

const expectGeneric404 = async (res: Response) => {
  expect(res.status).toBe(404);
  const body = await res.text();
  expect(body).toContain("404 - Page Not Found");
  expect(body).toContain(
    "The page you are looking for doesn't exist or has been moved.",
  );
  // nothing that reveals the platform
  expect(body).not.toMatch(/brewcc|dub|login|sign ?up|lilac/i);
  expect(body).not.toMatch(/<a\s|<script|<img|<link/i);
  expect(res.headers.get("x-powered-by")).toBeNull();
};

describe("custom domain routing", () => {
  test("root of a custom domain → generic 404", async () => {
    await expectGeneric404(await visit("https://meluncur.cc/"));
  });

  test("unknown slug → generic 404 (real 404 status, no redirect)", async () => {
    await expectGeneric404(await visit("https://meluncur.cc/slug-random"));
  });

  test("valid slug → redirect to the destination", async () => {
    const res = await visit("https://meluncur.cc/abc123");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/x");
  });

  test("app pages, assets and helpers are not reachable through a custom domain", async () => {
    for (const path of [
      "/login",
      "/register",
      "/stats/abc123",
      "/brand/wordmark.png",
      "/legal/terms.html",
      "/abc123+",
      "/https://example.com",
      "/wp-login.php",
    ]) {
      await expectGeneric404(await visit(`https://meluncur.cc${path}`));
    }
  });

  test("brewcc.online (and www) opens the same path on the app", async () => {
    const { APP_DOMAIN } = await import("@dub/utils");
    for (const [url, path] of [
      ["https://brewcc.online/", "/"],
      ["https://brewcc.online/login", "/login"],
      ["https://www.brewcc.online/register?ref=x", "/register?ref=x"],
    ]) {
      const res = await visit(url);
      expect(res.status).toBe(308);
      expect(res.headers.get("location")).toBe(`${APP_DOMAIN}${path}`);
    }
  });

  test("the app host still serves the app and its brand assets", async () => {
    const appHost = new URL(
      `https://${process.env.NEXT_PUBLIC_APP_DOMAIN || "app.dub.co"}`,
    ).host;
    expect((await visit(`https://${appHost}/login`)).status).toBe(200);
    const brand = await visit(`https://${appHost}/brand/wordmark.png`);
    expect(brand.status).toBe(200);
    expect(brand.headers.get("x-middleware-next")).toBe("1");
  });
});
