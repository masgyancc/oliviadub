import { DUB_DOMAINS_ARRAY } from "@dub/utils";
import { describe, expect, test, vi } from "vitest";

// the workspace owns one verified and one unverified custom domain
const workspaceDomains = [
  { slug: "meluncur.cc", verified: true, primary: true },
  { slug: "pending.cc", verified: false, primary: false },
];

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    domain: { findMany: vi.fn(async () => workspaceDomains) },
    link: { findUnique: vi.fn(async () => null) },
  },
}));

vi.mock("@/lib/brewcc/shared-domains", () => ({
  isSharedDomain: vi.fn(async () => false),
}));

vi.mock("@/lib/planetscale", () => ({
  checkIfUserExists: vi.fn(async () => true),
  checkIfKeyExists: vi.fn(async () => null),
  getRandomKey: vi.fn(async () => "abc123"),
}));

vi.mock("@/lib/api/links/malicious-link-check", () => ({
  maliciousLinkCheck: vi.fn(async () => false),
}));

const { processLink } = await import("@/lib/api/links/process-link");

const workspace = {
  id: "ws_a",
  plan: "enterprise",
  users: [{ role: "owner" }],
} as any;

const create = (domain: string, extra: Record<string, unknown> = {}) =>
  processLink({
    payload: { domain, key: "promo", url: "https://example.com" } as any,
    workspace,
    userId: "user_a",
    ...extra,
  });

describe("short link domains", () => {
  const defaultDomain = DUB_DOMAINS_ARRAY[0];

  test("default domains can't be used for new links", async () => {
    const res = await create(defaultDomain);
    expect(res.error).toMatch(/can't be used for short links/);
    expect(res.code).toBe("forbidden");
  });

  test("existing links on a default domain can still be edited (same domain + key)", async () => {
    const res = await create(defaultDomain, { skipKeyChecks: true });
    expect(res.error ?? "").not.toMatch(/can't be used for short links/);
  });

  test("unverified custom domains can't be used yet", async () => {
    const res = await create("pending.cc");
    expect(res.error).toMatch(/not verified yet/);
  });

  test("verified custom domains work", async () => {
    const res = await create("meluncur.cc");
    expect(res.error).toBeNull();
    expect(res.link.domain).toBe("meluncur.cc");
  });
});
