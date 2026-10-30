# BrewCC — Environment Variable Reference

No existing variable was renamed, removed or changed. BrewCC adds only **optional** variables, and every one has a safe default.
Values are never written to this document. Set them in Vercel → Project `dub` → Settings → Environment Variables (Production).

## New (optional)
| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME` | `cname.vercel-dns.com` | CNAME target shown to users for custom subdomains. Must point at Vercel, the platform BrewCC runs on. (Upstream Dub hardcoded `cname.dub.co`, which belongs to Dub.) |
| `NEXT_PUBLIC_CUSTOM_DOMAIN_A_RECORD` | `76.76.21.21` | A record shown for apex domains (Vercel anycast IP). |
| `EMAIL_FROM_DOMAIN` | `brewcc.online` | Domain used in sender addresses (`system@`, `notifications@`, `hello@`). Must be verified in Resend. |
| `EMAIL_REPLY_TO` | *(unset → no Reply-To)* | Reply-To address for outgoing emails. |

`NEXT_PUBLIC_*` variables are inlined at build time, so changing them requires a redeploy. Leaving them unset is fine.

## Existing variables relevant to BrewCC
| Variable | Used for |
|---|---|
| `VERCEL_API_KEY`, `TEAM_ID_VERCEL`, `VERCEL_PROJECT_ID` | Automatic custom domains (add/verify/remove hostnames on the Vercel project). **Required.** All three are already set in Production. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Rate limits + 60 s cache of user role/status. |
| `DATABASE_URL` | PlanetScale (new columns and table, see migration). |
| `RESEND_API_KEY` | **Currently empty.** Without it (and without SMTP), approval/rejection/suspension emails are only logged, not sent. Set it, and verify `EMAIL_FROM_DOMAIN` in Resend, to enable notifications. |
| `NEXT_PUBLIC_DUB_DEFAULT_DOMAINS` | Shared short domains for all workspaces (unchanged). Per-user custom domains no longer need to be added here. |

## Not needed
- No Cloudflare API token. Custom domains run through Vercel (see `BREWCC_CLOUDFLARE_SETUP.md`).
