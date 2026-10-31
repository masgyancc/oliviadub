import {
  parseDomainInput,
  replaceDomain,
} from "@/lib/bulk-replace/replace-domain";
import { describe, expect, test } from "vitest";

const input = (raw: string) => {
  const parsed = parseDomainInput(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed;
};

describe("parseDomainInput", () => {
  test("accepts a bare domain, a URL, www and a trailing slash", () => {
    expect(input("rika-wo.vercel.app")).toEqual({
      ok: true,
      matchKey: "rika-wo.vercel.app",
      origin: "https://rika-wo.vercel.app",
    });
    expect(input("https://www.toko1a.com/")).toEqual({
      ok: true,
      matchKey: "toko1a.com",
      origin: "https://www.toko1a.com",
    });
    expect(input("http://toko1a.com:8080").matchKey).toBe("toko1a.com:8080");
  });

  test("rejects ambiguous or invalid input", () => {
    expect(parseDomainInput("").ok).toBe(false);
    expect(parseDomainInput("https://toko1a.com/promo").ok).toBe(false);
    expect(parseDomainInput("toko1a.com?ref=x").ok).toBe(false);
    expect(parseDomainInput("toko1a.com#a").ok).toBe(false);
    expect(parseDomainInput("ftp://toko1a.com").ok).toBe(false);
    expect(parseDomainInput("not a domain").ok).toBe(false);
    expect(parseDomainInput("localhost-ish").ok).toBe(false);
  });
});

describe("replaceDomain", () => {
  const old = input("https://rika-wo.vercel.app").matchKey;
  const to = input("https://rikawedding.com").origin;
  const r = (url: string) => replaceDomain(url, old, to);

  test("1. fragment", () => {
    expect(r("https://rika-wo.vercel.app/#layanan")).toBe(
      "https://rikawedding.com/#layanan",
    );
    expect(r("https://rika-wo.vercel.app#promo")).toBe(
      "https://rikawedding.com#promo",
    );
  });

  test("2-3. path and nested path", () => {
    expect(r("https://rika-wo.vercel.app/lokasi")).toBe(
      "https://rikawedding.com/lokasi",
    );
    expect(r("https://rika-wo.vercel.app/lokasi/bali")).toBe(
      "https://rikawedding.com/lokasi/bali",
    );
  });

  test("4. query", () => {
    expect(r("https://rika-wo.vercel.app/booking?ref=instagram")).toBe(
      "https://rikawedding.com/booking?ref=instagram",
    );
    expect(r("https://rika-wo.vercel.app?ref=instagram&utm_source=ads")).toBe(
      "https://rikawedding.com?ref=instagram&utm_source=ads",
    );
  });

  test("5. path + query + fragment kept byte-for-byte", () => {
    expect(r("https://rika-wo.vercel.app/lokasi/bali?source=ads#kontak")).toBe(
      "https://rikawedding.com/lokasi/bali?source=ads#kontak",
    );
    expect(r("https://rika-wo.vercel.app/a%20b?q=%E2%9C%93#x")).toBe(
      "https://rikawedding.com/a%20b?q=%E2%9C%93#x",
    );
  });

  test("6. trailing slash preserved (and not added)", () => {
    expect(r("https://rika-wo.vercel.app/")).toBe("https://rikawedding.com/");
    expect(r("https://rika-wo.vercel.app")).toBe("https://rikawedding.com");
    expect(r("https://rika-wo.vercel.app/produk/")).toBe(
      "https://rikawedding.com/produk/",
    );
  });

  test("7. different port is not matched", () => {
    expect(r("https://rika-wo.vercel.app:8443/x")).toBeNull();
  });

  test("8. http and www are treated as the same domain", () => {
    expect(r("http://rika-wo.vercel.app/x")).toBe("https://rikawedding.com/x");
    expect(r("https://www.rika-wo.vercel.app/x")).toBe(
      "https://rikawedding.com/x",
    );
    expect(r("HTTPS://RIKA-WO.VERCEL.APP/Path")).toBe(
      "https://rikawedding.com/Path",
    );
  });

  test("9. similar but different hostnames are not matched", () => {
    expect(r("https://rika-wo.vercel.app.evil.com/x")).toBeNull();
    expect(r("https://shop.rika-wo.vercel.app/x")).toBeNull();
    expect(r("https://xrika-wo.vercel.app/x")).toBeNull();
  });

  test("10. old domain only in path or query is not matched", () => {
    expect(r("https://shopee.co.id/rika-wo.vercel.app")).toBeNull();
    expect(r("https://google.com/?q=https://rika-wo.vercel.app")).toBeNull();
  });

  test("11. already on the new domain is skipped", () => {
    expect(
      replaceDomain("https://toko1a.com/x", "toko1a.com", "https://toko1a.com"),
    ).toBeNull();
  });

  test("totally different destination domain (toko1a.com → sepedalipat.com)", () => {
    const k = input("www.toko1a.com").matchKey;
    const o = input("sepedalipat.com").origin;
    expect(
      replaceDomain("https://toko1a.com/checkout?ref=ig#bayar", k, o),
    ).toBe("https://sepedalipat.com/checkout?ref=ig#bayar");
    expect(replaceDomain("https://www.toko1a.com/produk/x", k, o)).toBe(
      "https://sepedalipat.com/produk/x",
    );
  });

  test("non-http and credential URLs are ignored", () => {
    expect(r("mailto:hi@rika-wo.vercel.app")).toBeNull();
    expect(r("https://user:pw@rika-wo.vercel.app/x")).toBeNull();
    expect(r("not a url")).toBeNull();
  });
});
