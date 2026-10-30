// DNS targets shown to users for custom domains. Self-hosted on Vercel, these must point at
// Vercel's edge (not dub.co's), so they default to Vercel's generic records.
export const DUB_CUSTOM_DOMAIN_A_RECORD =
  process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_A_RECORD || "76.76.21.21";
export const DUB_CUSTOM_DOMAIN_CNAME =
  process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME || "cname.vercel-dns.com";
export const DOMAIN_CONNECT_PROVIDER_ID = "dub.co";
export const DOMAIN_CONNECT_KEY_HOST = "_dck1";
export const DEFAULT_DC_SERVICE_APEX = "links-apex";
export const DEFAULT_DC_SERVICE_SUBDOMAIN = "links-subdomain";
export const DEFAULT_DC_SERVICE_EMAIL = "email";
