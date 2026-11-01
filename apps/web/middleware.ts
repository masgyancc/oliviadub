import { logger } from "@/lib/axiom/server";
import { transformMiddlewareRequest } from "@axiomhq/nextjs";
import { API_HOSTNAMES, DEFAULT_REDIRECTS, isValidUrl } from "@dub/utils";
import { isAppHostname } from "@dub/utils/src/constants";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { ApiMiddleware } from "./lib/middleware/api";
import { AppMiddleware } from "./lib/middleware/app";
import { LinkMiddleware } from "./lib/middleware/link";
import { genericNotFound } from "./lib/middleware/utils/generic-not-found";
import { parse } from "./lib/middleware/utils/parse";
import { supportedWellKnownFiles } from "./lib/well-known";

export const config = {
  runtime: "nodejs",
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/ routes
     * 2. /_next/ (Next.js internals)
     * 3. /_proxy/ (proxies for third-party services)
     * 4. Metadata files: favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest
     */
    "/((?!api/|_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { domain, path, key, fullKey } = parse(req);

  // Axiom logging
  logger.info(...transformMiddlewareRequest(req));
  ev.waitUntil(logger.flush());

  // BrewCC: brand assets and legal pages are matched only so short-link domains can 404
  // them below; on the app and api hosts they're served as before
  const isAppOrApi = isAppHostname(domain) || API_HOSTNAMES.has(domain);
  if (
    isAppOrApi &&
    (path.startsWith("/brand/") || path.startsWith("/legal/"))
  ) {
    return NextResponse.next();
  }

  // for app.dub.co
  if (isAppHostname(domain)) {
    return AppMiddleware(req);
  }

  // for api.dub.co
  if (API_HOSTNAMES.has(domain)) {
    return ApiMiddleware(req);
  }

  // BrewCC: short-link domains never expose app pages or assets (public stats, brand
  // files, legal pages), so visitors can't tell which platform serves the domain
  if (
    path.startsWith("/stats/") ||
    path.startsWith("/brand/") ||
    path.startsWith("/legal/")
  ) {
    return genericNotFound();
  }

  // for .well-known routes
  if (path.startsWith("/.well-known/")) {
    const file = path.split("/.well-known/").pop();
    if (file && supportedWellKnownFiles.includes(file)) {
      return NextResponse.rewrite(
        new URL(`/wellknown/${domain}/${file}`, req.url),
      );
    }
  }

  // default redirects for dub.sh
  if (domain === "dub.sh" && DEFAULT_REDIRECTS[key]) {
    return NextResponse.redirect(DEFAULT_REDIRECTS[key]);
  }

  // BrewCC: `domain/https://…` would open the app's create-link flow; not on short domains
  if (isValidUrl(fullKey)) {
    return genericNotFound();
  }

  return LinkMiddleware(req, ev);
}
