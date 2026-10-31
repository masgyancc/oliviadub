// BrewCC Bulk Destination Replacement – pure URL logic (no I/O, unit tested).
//
// Matching is by domain: "www." and http/https are ignored, the port must match.
// Only the scheme+host part is replaced; everything after it (path, query, #fragment,
// trailing slash) is copied character-for-character from the original URL.

export type DomainInput =
  | { ok: true; matchKey: string; origin: string }
  | { ok: false; error: string };

const stripWww = (hostname: string) => hostname.replace(/^www\./, "");

// "toko1a.com" / "https://www.toko1a.com/" → key "toko1a.com", origin "https://www.toko1a.com"
export function parseDomainInput(raw: string): DomainInput {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Enter a domain." };

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
    ? input
    : `https://${input}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, error: `"${input}" is not a valid domain or URL.` };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      error: "Only http:// and https:// URLs are supported.",
    };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      error: "URLs with a username or password are not supported.",
    };
  }
  if (!url.hostname.includes(".") && url.hostname !== "localhost") {
    return { ok: false, error: `"${input}" is not a valid domain.` };
  }
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
    return {
      ok: false,
      error: `Enter only the domain (e.g. ${url.host}), without a path, "?" or "#".`,
    };
  }

  return {
    ok: true,
    matchKey: stripWww(url.hostname) + (url.port ? `:${url.port}` : ""),
    origin: url.origin,
  };
}

// splits "scheme://authority" from the rest without re-encoding anything
const SPLIT = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)(.*)$/is;

export function replaceDomain(
  url: string,
  oldKey: string,
  newOrigin: string,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;

  const key =
    stripWww(parsed.hostname) + (parsed.port ? `:${parsed.port}` : "");
  if (key !== oldKey) return null;

  const match = url.match(SPLIT);
  if (!match) return null;
  const rest = match[2];

  const result = newOrigin + rest;
  if (result === url) return null; // already on the new domain

  try {
    new URL(result);
  } catch {
    return null;
  }
  return result;
}
