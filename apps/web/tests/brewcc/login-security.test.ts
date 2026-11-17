import {
  isPastMaxAge,
  loginStartedAt,
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_MAX_AGE_MS,
} from "@/lib/auth/session-policy";
import { isTurnstileEnabled, verifyTurnstile } from "@/lib/auth/turnstile";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("session policy", () => {
  test("idle timeout is one hour, absolute limit seven days", () => {
    expect(SESSION_IDLE_TIMEOUT_SECONDS).toBe(3600);
    expect(SESSION_MAX_AGE_MS).toBe(7 * 24 * 3600 * 1000);
  });

  test("tokens from before the policy start counting now", () => {
    expect(loginStartedAt({}, 1000)).toBe(1000);
    expect(loginStartedAt({ loginAt: 500 }, 1000)).toBe(500);
  });

  test("a login older than seven days is expired", () => {
    const now = Date.now();
    expect(isPastMaxAge(now - SESSION_MAX_AGE_MS + 60_000, now)).toBe(false);
    expect(isPastMaxAge(now - SESSION_MAX_AGE_MS - 1, now)).toBe(true);
  });
});

describe("turnstile", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("off without keys: logins keep working", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(isTurnstileEnabled()).toBe(false);
    expect(await verifyTurnstile(undefined)).toBe(true);
  });

  test("on with keys: a missing or rejected token fails, a valid one passes", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await verifyTurnstile(undefined)).toBe(false);

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const token = new URLSearchParams(init.body as string).get("response");
      return new Response(JSON.stringify({ success: token === "good" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await verifyTurnstile("bad")).toBe(false);
    expect(await verifyTurnstile("good", "1.2.3.4")).toBe(true);
    const sent = new URLSearchParams(fetchMock.mock.calls[1][1].body as string);
    expect(sent.get("secret")).toBe("secret");
    expect(sent.get("remoteip")).toBe("1.2.3.4");
  });
});
