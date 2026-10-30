# BrewCC — Implementation Report

Branch: `feature/brewcc-platform-transformation` (from production `f7a097891a`). Nothing is deployed and production data is untouched.

## 1. Master Admin + Registration Approval

### Data model (additive migration, `apps/web/prisma/brewcc-migrations/20261031_platform_access/`)
- `User.platformRole` enum `user | master_admin` (default `user`). This is the platform role, separate from workspace roles.
- `User.status` enum `pending | approved | rejected | suspended` (default **`pending`**, fail-closed), plus `statusReason`, `statusUpdatedAt`, `statusUpdatedById`.
- `AdminAuditLog` table: actor, action, target user/domain, from → to, reason, timestamp.
- Backfill: all existing users → `approved`. The two confirmed accounts → `master_admin`.

### Enforcement (server-side, never trusts the client)
| Layer | File | Behaviour |
|---|---|---|
| Helper | `apps/web/lib/auth/platform-access.ts` | Reads role/status from the DB (60 s Redis cache, invalidated on every change). Provides `assertUserApproved` and `assertMasterAdmin`. |
| REST API (session **and** API keys/OAuth tokens) | `lib/auth/workspace.ts` (`withWorkspace`) | Non-approved users → `403`. Covers links, domains, analytics, tags, folders, tokens, webhooks, and every other workspace route. |
| User-level API | `lib/auth/session.ts` (`withSession`) | Gated by default. Only `GET /api/user` opts out (`allowUnapproved`), so the status page can read the user's own profile. |
| Server actions | `lib/actions/safe-action.ts` | `authUserActionClient` and `authActionClient` are gated. New `masterAdminActionClient`. |
| Pages | `lib/middleware/app.ts` | Non-approved users can only see `/pending`. `/admin/*` is limited to master admins (re-checked in the admin layout). |
| Sign-up | `lib/auth/options.ts`, `lib/actions/create-user-account.ts` | New accounts are explicitly `pending` (OAuth, email, password, SAML all hit the DB default). Machine users (API keys) are created `approved`. |

Lock-out protection: an admin cannot change their own status or role, and a master admin cannot be suspended or rejected before being demoted. Because the acting admin always remains, there is always at least one master admin.

### UI
- `/pending`: "Your account is awaiting approval" page with name, email, registration date, status and reason (for rejected/suspended), and Sign out.
- `/admin` (master admins only; **Admin** item in the user menu):
  - Overview: users, pending, suspended, workspaces, links, active/total custom domains
  - Pending Approvals: Accept / Reject (optional reason)
  - Users: filter by status, search, Approve/Reject/Suspend/Reactivate, make or remove master admin
  - Domains: all custom domains with owner/status/last check, Disable/Enable/Delete
  - Audit Log: last 200 admin actions
- Notifications: approve/reject/suspend/reactivate emails through the existing `sendEmail`. **They are sent only once `RESEND_API_KEY` is configured.** Today production has no email provider, so they are only logged.

## 2. Custom domains
The automated flow already existed (Vercel Domains API + hourly verification cron). Changes:
- **Bug fixed:** DNS instructions told users to point CNAMEs at `cname.dub.co`, which belongs to Dub's infrastructure. They now default to `cname.vercel-dns.com` / `76.76.21.21` (env-overridable).
- Cloudflare guidance in the DNS card: use grey cloud, and CNAME flattening for apex domains.
- Platform hostnames (app/API/short/default domains and their subdomains, `vercel.app`, ...) cannot be claimed.
- Rate limits: adding domains is capped at 10 per workspace per hour, verification checks at 30 per workspace per minute.
- Admin domain management (see above).
See `BREWCC_CLOUDFLARE_SETUP.md`.

## 3. Rebranding
- New logo (geometric lowercase "b" on a circle) and lowercase `brewcc` wordmark: `packages/ui/src/logo.tsx`, `wordmark.tsx`, `nav-wordmark.tsx`.
- Favicon (`apps/web/public/favicon.ico`), PNG icons, apple-touch icon, OG image and email wordmark in `apps/web/public/brand/`. Middleware excludes `/brand/` so the files are served on every host.
- Metadata (`constructMetadata`): title `… | BrewCC`, description, OG/Twitter image, `metadataBase` = app domain. PWA manifest updated.
- About 150 user-facing strings in `apps/web/app`, `apps/web/ui`, `packages/ui`, `packages/email`: "Dub" → "BrewCC". Imports, identifiers, comments, API names, env vars and the DB are unchanged.
- Emails: dashboard links use `APP_DOMAIN` instead of `app.dub.co`. Sender addresses come from `EMAIL_FROM_DOMAIN`, and the Dub founder signature and "Dub Technologies, Inc." are removed.
- The auth pages no longer load Dub's own analytics script, and the logo links to `/`.
- Legal pages (`/legal/*.html`) rebranded.

Remaining Dub references (intentional or low-visibility): internal identifiers (`DubApiError`, `@dub/*` packages, `DUB_*` env), links to Dub's public docs/help articles in tooltips, marketing nav content of dub.co (not used in the dashboard), and Dub's yearly "wrapped" broadcast template (never sent by BrewCC).

## 4. Verification performed
- `tsc --noEmit` (apps/web): **0 errors**
- `next build` (production mode, local): see "Build result" below
- Migration diff against production: additive only (ALTER ADD COLUMN x5, CREATE TABLE, CREATE INDEX)

### Not yet verified (requires deployment or a staging database)
- End-to-end flows in a browser (sign-up → pending → approve, suspend, admin pages, custom domain activation with real DNS and SSL)
- Email delivery (no provider configured)

## Build result
_(filled in below after the local build)_

## Files
New: `lib/auth/platform-access.ts`, `lib/actions/admin/admin-actions.ts`, `app/app.dub.co/(admin)/admin/**`, `app/app.dub.co/(pending)/pending/**`, `prisma/schema/admin.prisma`, `prisma/brewcc-migrations/**`, `public/brand/**`, `BREWCC_*.md`.
Modified (logic): `prisma/schema/schema.prisma`, `lib/auth/{workspace,session,options}.ts`, `lib/actions/{safe-action,create-user-account}.ts`, `lib/middleware/app.ts`, `middleware.ts`, `app/api/user/route.ts`, `app/api/tokens/route.ts`, `app/api/domains/route.ts`, `app/api/domains/[domain]/verify/route.ts`, `lib/api/domains/utils.ts`, `lib/domain-connect/constants.ts`, `ui/domains/domain-configuration.tsx`, `ui/layout/sidebar/user-dropdown.tsx`, `lib/types.ts`, `packages/utils/src/constants/{main,reserved-slugs}.ts`, `packages/utils/src/functions/construct-metadata.ts`, `packages/email/src/{resend/constants,send-via-resend,send-via-nodemailer}.ts`.
Modified (text only): rebranding strings across the files listed by `git diff --stat`.
