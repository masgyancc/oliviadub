# BrewCC — Audit Report (Phase 1)

Audit date: 2026-10-31
Method: read-only. Vercel API (GET only), public DNS lookups, PlanetScale (SELECT only), source code review.
No production data, configuration, DNS, or deployment was changed. No secret values are reproduced in this document.

---

## 1. Actual architecture

```
            Cloudflare DNS (DNS-only, not proxied)
   brewcc.online / lilac-orbit.com ──A──► Vercel edge (216.198.79.1)
   app.lilac-orbit.com ──CNAME──► <project>.vercel-dns-017.com
                                   │
                         Vercel project "dub" (team "olivia", Pro plan)
                         Next.js app, root dir apps/web, Node 22.x
                         Git integration: github.com/oliviaevergarden44-a11y/oliviadub, branch main
                                   │
     ┌──────────────┬──────────────┼───────────────┬──────────────────┐
 PlanetScale MySQL   Upstash Redis   Upstash QStash   Tinybird (eu-central)  Cloudflare R2
 (db "oliviadbdub")  (cache)         (queues/jobs)    (click analytics)      (assets.lilac-orbit.com)
```

- **There is no VPS.** No Nginx, PM2, Docker, Traefik or Caddy. Vercel handles routing, TLS and restarts.
- **Deployment = `git push` to `main`.** Vercel builds automatically. Rollback = "Promote/Instant Rollback" to an earlier deployment in Vercel.
- The current production deployment is `dpl_C69v7WTa6WJdGhBezPHEGmqTMr9D` (commit `f7a097891a`, 2026-10-30).
- **The local folder `D:\seo\dub\dub.link-main` is NOT the production code.** It is an older upstream ZIP and 25 self-hosting files differ. All BrewCC work happens in the clone `D:\seo\dub\oliviadub`, which matches production `HEAD`.

### Hostnames
| Hostname | Role |
|---|---|
| `app.lilac-orbit.com` | Dashboard (`NEXT_PUBLIC_APP_DOMAIN`), NextAuth URL |
| `api.lilac-orbit.com` | Public API |
| `lilac-orbit.com` | Default short domain (`NEXT_PUBLIC_APP_SHORT_DOMAIN`) |
| `brewcc.online` | Second shared default short domain (`NEXT_PUBLIC_DUB_DEFAULT_DOMAINS`) |

Note: the dashboard lives at `app.lilac-orbit.com`, not at `brewcc.online`. Moving the dashboard to `app.brewcc.online` is possible but would invalidate current login sessions and requires updating the Google/GitHub OAuth redirect URIs. It is **not** included in this plan unless you request it.

## 2. Technology stack
- Monorepo pnpm 9.15.9 + Turborepo. Packages: `apps/web`, `packages/{ui,utils,email,tailwind-config,...}`.
- Next.js (App Router) with middleware on the Node runtime. React 19.
- Prisma 6.19.1 with `@prisma/adapter-planetscale`. **No migrations folder.** The schema is applied with `prisma db push` (the PlanetScale pattern).
- NextAuth v4 with JWT sessions. Providers: Google, GitHub, Email (magic link), Credentials (password), SAML.
- Vercel Cron: 11 jobs, including `/api/cron/domains/verify` every hour.
- License: AGPL-3.0, with `ee/` directories under the Dub commercial license (see Risks).

## 3. Database (production, SELECT only)
| Table | Rows |
|---|---|
| User | 2 |
| Project (workspace) | 2 |
| ProjectUsers | 2 |
| Link | 3 |
| Domain (custom domain) | **0** |
| Token (API key) | 0 |
| Session | 0 (JWT, not stored in the DB) |

### Users (Master Admin candidates)
| User ID | Email | Login | Workspace | Role |
|---|---|---|---|---|
| `user_1M671R5CJ5VVPFB9DX7DR9WZX` | oliviaevergarden44@gmail.com | Google | `olivia` (`ws_1M671RGTYCY1R026FQVY8PSGQ`, = `NEXT_PUBLIC_DUB_WORKSPACE_ID`) | owner |
| `user_1M672MTTBZAB47QVRF0SAVXJ3` | ameeragin4@gmail.com | Google | `masgin` (`ws_1M672PA2ZS6G6NNQE6KKKR84H`) | owner |

These are the **only two users** in the database. Both workspaces use plan `enterprise` with `domainsLimit 1000`, set manually. New workspaces default to `free` with `domainsLimit 3`.

`DefaultDomains`: one row per workspace, flags for the shared domains (lilac-orbit.com, brewcc.online, ...).

## 4. Authentication and authorization
- Login is Google-only so far (neither user has a `passwordHash`).
- Registration: `/register` (email + password or OAuth). Users are created through `CustomPrismaAdapter.createUser` (`apps/web/lib/auth/options.ts`) or the `createUserAccount` action.
- Server-side authorization points (wrappers):
  - `withWorkspace` (`lib/auth/workspace.ts`), used by 46 route files and also handling API key auth.
  - `withSession` (`lib/auth/session.ts`), used by 10 route files.
  - `authActionClient` / `authUserActionClient` (`lib/actions/safe-action.ts`), used by 18 action files.
  - `AppMiddleware` (`lib/middleware/app.ts`) for page redirects.
- "Platform admin" exists only as membership in `DUB_WORKSPACE_ID` (`lib/auth/admin.ts`). **There is no `role` or `status` field on User** and no admin dashboard (Dub's admin app is not part of the open-source repo).
- The JWT stores `token.user` and refreshes from the DB only on `trigger === "update"`. A status/role check therefore must hit the DB (with a short cache), not rely on the JWT.

## 5. Current custom domain mechanism
- **Dub already has a fully automated custom domain flow via the Vercel Domains API:**
  - `POST /api/domains` validates the domain, calls `addDomainToVercel` (adds it to the Vercel project) and stores the `Domain` row.
  - The UI shows the required DNS records (`get-config-response.ts`): CNAME for subdomains, A record or CNAME-flattening for apex domains, and TXT if Vercel requests ownership verification.
  - `GET /api/domains/[domain]/verify` checks status, and the hourly cron `/api/cron/domains/verify` rechecks automatically.
  - Vercel issues the SSL certificate (Let's Encrypt) once DNS is correct, with no restart and no redeploy.
- The manual process you have been using (edit `.env`, redeploy) is **`NEXT_PUBLIC_DUB_DEFAULT_DOMAINS`**, the list of *shared* domains for all workspaces. That is a different mechanism from per-user custom domains.
- The `Domain` table is empty, so the per-user flow has never been used in production. All prerequisites are in place: `VERCEL_API_KEY`, `TEAM_ID_VERCEL` and `VERCEL_PROJECT_ID` are set in Vercel production, and the team is on Pro.

## 6. Cloudflare
- `brewcc.online` and `lilac-orbit.com` use Cloudflare nameservers (`ace`/`maisie.ns.cloudflare.com`), but the records are **DNS-only**: they point directly to Vercel and are not proxied.
- `.env` and Vercel contain **no Cloudflare API token**, only R2 credentials. Cloudflare for SaaS cannot be inspected or enabled without a token from you.
- **Recommendation: do not use Cloudflare for SaaS.** The application runs on Vercel, and Vercel already provides the custom hostname, verification and SSL that Cloudflare for SaaS would offer. Putting Cloudflare for SaaS in front of Vercel means:
  - double TLS and a reverse proxy, which Vercel advises against (it breaks Vercel's certificate issuance and caching);
  - every user domain must still be added to Vercel anyway, or routed through a separate fallback origin;
  - extra cost (Cloudflare for SaaS bills per hostname above the free quota).
- Users who keep their domain on Cloudflare only need to add the record shown by BrewCC with the **proxy turned off (grey cloud)**. This must be stated clearly in the UI.

## 7. Risks
| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Schema changes via `prisma db push` on production | A destructive push could drop columns or tables | Only *additive* changes (new nullable/default columns, new tables). Review `prisma db push` output before applying, and never use `--accept-data-loss`. Use a PlanetScale branch + deploy request if the database has safe migrations enabled. |
| R2 | New status column default | If the default were `approved`, any missed creation path would let new users bypass approval | Column default is `pending` (fail-closed). Backfill the 2 existing users to `approved` immediately after the push, **before** the new code is deployed. |
| R3 | Both admins locked out | Platform without an admin | Server-side guard: a `master_admin` cannot be suspended or demoted, and an admin cannot change their own role. |
| R4 | Gating only on the frontend | API bypass | Enforcement inside `withWorkspace`, `withSession`, `authActionClient` and middleware, which covers API key access as well. |
| R5 | Email not configured in production (`RESEND_API_KEY` is empty, no SMTP on Vercel) | Approval/rejection notifications are not sent | The code uses the existing `sendEmail`. Notifications go out once `RESEND_API_KEY` is set. Until then the pending status page and dashboard are the main channel. |
| R6 | Vercel Preview builds have no environment variables (all env vars are production-only) | A feature branch preview would fail or behave incorrectly | Add Preview env vars pointing at a **PlanetScale dev branch**, never the production database, or test locally. |
| R7 | Vercel builds previously ran into OOM | A larger build could fail | Changes are kept lean. Watch the build log, and use Instant Rollback if needed. |
| R8 | Rebranding `ee/` code and the license | Dub's commercial license covers `ee/` | Changing public text is allowed, but under AGPL the modified source must stay available to users (the public GitHub repo satisfies this). For commercial use of `ee/` features, review the Dub EE license yourself. |
| R9 | Secrets in a local `.env` that was shared via Telegram | Credential exposure | The owner decided not to rotate. Noted here as an accepted risk. |
| R10 | The `/admin` path collides with a workspace slug | Routing conflict | `admin` is already in `reserved-slugs.ts`, so it is safe. |

## 8. Files to modify (plan)
**Branding**
- `packages/ui/src/logo.tsx` (and wordmark/icon variants), `packages/utils/src/functions/construct-metadata.ts`
- `apps/web/public/favicon.ico` + favicon/OG assets (moved from `assets.dub.co` to local `/public`)
- Auth layout, nav, footer, email templates (`packages/email/src/templates/*`), public-facing strings ("Dub" → "BrewCC") in `apps/web/app`, `apps/web/ui`, `packages/ui`. About 124 string occurrences to review; internal names stay as they are.

**Master Admin + approval**
- `apps/web/prisma/schema/schema.prisma`: User + `role`, `status`, `statusReason`, `statusUpdatedAt`, `statusUpdatedById`
- `apps/web/lib/auth/options.ts` (new users → `pending`), `lib/actions/create-user-account.ts` (if it exists)
- `apps/web/lib/auth/workspace.ts`, `lib/auth/session.ts`, `lib/actions/safe-action.ts` (status gate)
- `apps/web/lib/middleware/app.ts` (redirect non-approved users → `/pending`)

**Files to add**
- `apps/web/prisma/schema/admin.prisma`: `AdminAuditLog` model
- `apps/web/lib/auth/platform-admin.ts`: `requireMasterAdmin`, `getUserAccessStatus` (Redis cache)
- `apps/web/app/app.dub.co/(admin)/admin/...`: Overview, Users, Pending Approvals, Domains, Audit Log
- `apps/web/app/api/admin/...` or server actions `lib/actions/admin/*` (approve/reject/suspend/reactivate/set-role/domain disable)
- `apps/web/app/app.dub.co/(auth)/pending/page.tsx`: "Your account is awaiting approval"
- Email templates: account-approved / rejected / suspended / reactivated
- Docs: `BREWCC_IMPLEMENTATION_REPORT.md`, `BREWCC_DEPLOYMENT_REPORT.md`, `BREWCC_ROLLBACK_GUIDE.md`, `BREWCC_CLOUDFLARE_SETUP.md`, `BREWCC_ENV_REFERENCE.md`

**Custom domains** (extend, do not replace)
- Domain UI: a clear explanation for Cloudflare users (grey cloud, CNAME flattening for apex)
- Rate limit on add/verify domain
- Admin → Domains: view all domains, disable/enable (uses the existing `Domain.disabled`/`archived` fields where available)

## 9. Migration plan (additive, safe)
1. `User.role` String default `"user"`, `User.status` String default `"pending"`, plus nullable `statusReason`, `statusUpdatedAt`, `statusUpdatedById`. Add an index on `status`.
2. New table `AdminAuditLog` (id, actorId, targetUserId?, targetDomain?, action, fromValue?, toValue?, reason?, createdAt).
3. Backfill (one-off data change, **requires approval**):
   `UPDATE User SET status='approved'` for all existing users, then `role='master_admin'` for the 2 confirmed user IDs.
4. Deploy code.

Order: 1–2 (db push) → 3 (backfill) → 4 (deploy). Steps 1–3 are harmless to the old code, which ignores the new columns.

## 10. Backup and rollback
- **Database:** PlanetScale keeps automatic daily backups. Before the push, create a manual backup in the PlanetScale dashboard (Branch → Backups → Create backup) or via `pscale backup create`. A logical export of all tables (SELECT → JSON) can also be taken locally outside the repo.
- **Code:** production = commit `f7a097891a`. Rollback = Vercel Instant Rollback to `dpl_C69v7WTa6WJdGhBezPHEGmqTMr9D`, or `git revert` on `main`.
- **Schema:** the new columns can stay in place, since the old code ignores them. A full rollback = drop the new columns/table, only after review.
- **Env/config:** only additions. Existing env vars are not changed.
- **DNS:** no DNS changes required.
