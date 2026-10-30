# BrewCC — Deployment Procedure & Report

Status: **NOT DEPLOYED.** Production is untouched. Every step below needs the owner's explicit approval before it runs.

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
