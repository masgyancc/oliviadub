# BrewCC — Deployment Procedure & Report

Status: **DEPLOYED on 2026-10-31** (approved by the owner).

| Step | Result |
|---|---|
| Backup | Logical export of all 40 tables (19 rows) → `D:\seo\dub\backups\db-2026-10-31-pre-brewcc` (outside the repo) |
| `01_up.sql` | Applied with `prisma db execute`, success |
| `02_backfill.sql` | Applied. Both existing users are `approved` + `master_admin`, links still 3 |
| Code | `main` fast-forwarded `f7a0978 → 2d911a0` (pushed by the owner) |
| Vercel | `dpl_CSf7GK2udFPKEMVghVb7NkSBRNLT` → READY (production) |

Post-deploy checks run anonymously:
- `/login` returns 200, title "Sign in to BrewCC | BrewCC", BrewCC wordmark shown, no "Dub" in the meta tags
- `/admin`, `/admin/approvals`, `/pending` return 307 → `/login?next=…` (protected)
- `/favicon.ico` and `/brand/og.png` return 200
- Existing links: `lilac-orbit.com/3B971vh` → 302 google.com, `lilac-orbit.com/tes` → 302 rika-wo.vercel.app, `brewcc.online/` → 200
- `api.lilac-orbit.com/links` without auth returns 401

Still to verify while logged in (requires a browser session): admin pages for both master admins, a test sign-up → pending → approve, and custom domain activation.

---

## Pre-flight (done locally)
- [x] Branch `feature/brewcc-platform-transformation` cut from production `HEAD` (`f7a097891a`)
- [x] `tsc --noEmit` on apps/web: 0 errors
- [x] `next build` (production mode) locally: success
- [x] Migration SQL generated with `prisma migrate diff` against production: additive only
- [ ] Manual end-to-end test against a non-production database (needs a PlanetScale dev branch; see Staging)

## Staging (recommended)
Vercel Preview builds currently have **no** environment variables, since all are production-only. To get a safe staging:
1. PlanetScale: create a branch `brewcc-staging` from `main` (it copies the schema, not the data, unless you restore a backup into it).
2. Vercel: add Preview-scoped env vars, copied from production **except** `DATABASE_URL`, which points at the staging branch.
3. Push the feature branch. Vercel builds a preview URL. Note that login cookies are scoped to `.lilac-orbit.com`, so test with the preview URL's own login.

## Production steps (in this order)
1. **Backup**: PlanetScale → Backups → *Create backup* on `main`. Wait until it completes.
2. **Schema**: apply `apps/web/prisma/brewcc-migrations/20261031_platform_access/01_up.sql`
   - if PlanetScale *safe migrations* is ON: apply it on a branch → Deploy request → Deploy;
   - otherwise: `pnpm prisma:push` from `apps/web`, checking that the output lists only the additions above (never accept data loss).
   Old code keeps working (it ignores the new columns).
3. **Backfill**: run `02_backfill.sql` right away. Then verify: every existing user is `approved`, and exactly the 2 confirmed accounts are `master_admin`.
4. **Code**: merge `feature/brewcc-platform-transformation` into `main` (PR, no force push). Vercel deploys automatically.
5. **Optional env** (see `BREWCC_ENV_REFERENCE.md`): `RESEND_API_KEY` + `EMAIL_FROM_DOMAIN` for notifications.

## Post-deploy verification checklist
- [ ] `app.lilac-orbit.com` loads the BrewCC logo, title "BrewCC", and the BrewCC favicon
- [ ] Both master admins log in → dashboard works, user menu shows **Admin**, /admin pages load
- [ ] Existing short links on `lilac-orbit.com` and `brewcc.online` still redirect
- [ ] New test signup lands on `/pending`; `POST /api/links` with its session returns 403
- [ ] Approve the test user → dashboard and onboarding work
- [ ] Suspend → /pending, and API calls return 403. Reactivate restores access
- [ ] Add a test subdomain, set the CNAME (grey cloud), refresh → Valid Configuration, HTTPS works, a link on it redirects
- [ ] Vercel logs: no new errors. Crons still run

## Rollback
See `BREWCC_ROLLBACK_GUIDE.md` (Vercel Instant Rollback to `dpl_C69v7WTa6WJdGhBezPHEGmqTMr9D`).

## Vercel Firewall: bot challenge on all short-link domains (2026-10-31)
Applied via the Vercel API at the owner's request. Firewall config version 2, rule id `rule_brew_cc_challenge_short_links_IXpytO`.

**Rule "BrewCC challenge short links"**: action **Challenge** when ALL of:
- host is NOT `app.lilac-orbit.com` / `api.lilac-orbit.com`
- host does NOT end with `.vercel.app` (deployment hosts and cron)
- path does NOT match `^/(\.well-known|_next|api|_proxy|brand)(/|$)` (SSL/ACME, assets, API, brand images)

Effect: every short-link host (`lilac-orbit.com`, `brewcc.online`, `meluncur.cc` and every future custom domain) serves the Vercel Security Checkpoint once per visitor, then redirects normally. Accepted trade-offs: chat-app link previews may fail, recorded clicks may drop, and the first click is slower.

Verified after applying:
| URL | Result |
|---|---|
| `meluncur.cc/tes`, `lilac-orbit.com/3B971vh`, `brewcc.online/` | `429` + `x-vercel-mitigated: challenge` (browser solves the challenge, then the redirect runs) |
| `app.lilac-orbit.com/login` | 200 (not challenged) |
| `api.lilac-orbit.com/links` | 401 (not challenged) |
| `app.lilac-orbit.com/brand/og.png` | 200 |
| `meluncur.cc/.well-known/acme-challenge/*` | passes through (SSL issuance for new domains still works) |

**Disable or adjust:** Vercel → Project `dub` → Firewall → rule "BrewCC challenge short links" → toggle off or delete, then Publish. Alternatively, via API: `PATCH /v1/security/firewall/config` with `{"action":"rules.remove","id":"rule_brew_cc_challenge_short_links_IXpytO"}`.
