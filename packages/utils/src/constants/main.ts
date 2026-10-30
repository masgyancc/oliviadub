// ---------------------------------------------------------------------------
// Self-hosting configuration
//
// Set these in .env (and in Vercel → Environment Variables):
//   NEXT_PUBLIC_APP_DOMAIN        dashboard host, e.g. "app.acme.com"
//   NEXT_PUBLIC_APP_SHORT_DOMAIN  default short-link domain, e.g. "ac.me"
//   NEXT_PUBLIC_API_DOMAIN        (optional) API host, defaults to "api.<root>"
//
// When unset, every value falls back to dub.co's own hosts so upstream
// behaviour is unchanged.
// ---------------------------------------------------------------------------

const IS_PRODUCTION = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
const IS_PREVIEW = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";

export const APP_HOSTNAME = process.env.NEXT_PUBLIC_APP_DOMAIN || "app.dub.co";
export const SHORT_DOMAIN =
  process.env.NEXT_PUBLIC_APP_SHORT_DOMAIN || "dub.sh";

// "app.acme.com" -> "acme.com"; "acme.com" -> "acme.com"
export const ROOT_DOMAIN = APP_HOSTNAME.replace(/^app\./, "");
export const API_HOSTNAME =
  process.env.NEXT_PUBLIC_API_DOMAIN || `api.${ROOT_DOMAIN}`;

// true only for dub.co's own deployment; gates dub.co-specific behaviour
export const IS_DUB_CO = APP_HOSTNAME === "app.dub.co";

// cookie domain for the auth session (must be shared by app + api hosts)
export const COOKIE_DOMAIN = `.${ROOT_DOMAIN}`;

export const API_HOSTNAMES = new Set([
  API_HOSTNAME,
  "api.dub.co",
  "api-staging.dub.co",
  `api.${SHORT_DOMAIN}`,
  "api.localhost:8888",
  "api.localhost",
]);

export const API_DOMAIN = IS_PRODUCTION
  ? `https://${API_HOSTNAME}`
  : IS_PREVIEW
    ? "https://api-staging.dub.co"
    : "http://api.localhost:8888";

export const APP_DOMAIN = IS_PRODUCTION
  ? `https://${APP_HOSTNAME}`
  : IS_PREVIEW
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL || "preview.dub.co"}`
    : "http://localhost:8888";

export const APP_DOMAIN_WITH_NGROK = IS_PRODUCTION
  ? `https://${APP_HOSTNAME}`
  : IS_PREVIEW
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL || "preview.dub.co"}`
    : process.env.NEXT_PUBLIC_NGROK_URL || "http://localhost:8888";

// marketing site (dub.co); self-hosted instances point this at the app
export const WEBSITE_URL = IS_DUB_CO ? "https://dub.co" : APP_DOMAIN;

export const isAppHostname = (hostname: string) => {
  if (IS_PREVIEW) {
    // pattern of our preview URLs are always "dub-<random-string>.dub.co"
    return hostname.startsWith("dub-") && hostname.endsWith(".dub.co");
  }
  return new Set([APP_HOSTNAME, "localhost:8888", "localhost"]).has(hostname);
};

// BrewCC brand images (apps/web/public/brand), served from the app domain
export const DUB_LOGO = `${APP_DOMAIN}/brand/icon-512.png`;
export const DUB_LOGO_SQUARE = `${APP_DOMAIN}/brand/icon-512.png`;
export const DUB_QR_LOGO = `${APP_DOMAIN}/brand/icon-512.png`;
export const DUB_WORDMARK = `${APP_DOMAIN}/brand/wordmark.png`;
export const DUB_THUMBNAIL = `${APP_DOMAIN}/brand/og.png`;

// Self-hosting: the "master" workspace. Members of this workspace are treated
// as platform admins (see lib/auth/admin.ts) and it owns the default domains
// and official integrations. Set NEXT_PUBLIC_DUB_WORKSPACE_ID to your own
// workspace id (e.g. "ws_..."); defaults to dub.co's workspace.
export const DUB_WORKSPACE_ID =
  process.env.NEXT_PUBLIC_DUB_WORKSPACE_ID || "cl7pj5kq4006835rbjlt2ofka";
export const ACME_WORKSPACE_ID = "clrei1gld0002vs9mzn93p8ik";
export const LEGAL_WORKSPACE_ID = "clrflia0j0000vs7sqfhz9c7q";
export const LEGAL_USER_ID = "clqei1lgc0000vsnzi01pbf47";

export const R2_URL = process.env.STORAGE_BASE_URL || "https://dubassets.com";
