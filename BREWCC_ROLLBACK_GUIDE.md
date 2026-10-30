# BrewCC — Rollback Guide

## Reference points
| Item | Value |
|---|---|
| Last production version before BrewCC | commit `f7a097891a` / deployment `dpl_C69v7WTa6WJdGhBezPHEGmqTMr9D` |
| Repository / branch | `oliviaevergarden44-a11y/oliviadub`, production branch `main` |
| BrewCC branch | `feature/brewcc-platform-transformation` |
| Database | PlanetScale `oliviadbdub` |

## 1. Application rollback (fast, recommended first)
1. Vercel → Project `dub` → Deployments → pick `dpl_C69v7WTa6WJdGhBezPHEGmqTMr9D` → **Instant Rollback** (or *Promote to Production*).
2. Verify: `https://app.lilac-orbit.com` login, an existing short link on `lilac-orbit.com` / `brewcc.online` redirects.
3. To make it permanent in Git: `git revert -m 1 <merge-commit>` on `main` and push. **Never force push.**

The database does **not** need to be rolled back. The old code ignores `User.platformRole`, `User.status`, `User.status*` and the `AdminAuditLog` table.

Side effect while rolled back: users who signed up under BrewCC (status `pending`) get full access, because the old code has no approval gate. Review them in **Admin → Pending Approvals** after re-deploying BrewCC.

## 2. Schema rollback (only if really required)
Run only after step 1, and only if the new columns must be removed:
`apps/web/prisma/brewcc-migrations/20261031_platform_access/03_down.sql`
This permanently deletes approval statuses and the admin audit log. Take a PlanetScale backup first.

## 3. Data restore (last resort)
PlanetScale → database → Backups → choose the backup taken before deployment → **Restore to a new branch**, inspect it, then promote it. Restoring drops every link/click/user created after the backup, so weigh this against those transactions. Do not restore automatically.

## 4. Specific issues
| Problem | Fix |
|---|---|
| A master admin cannot reach /admin | Check `SELECT platformRole, status FROM User WHERE id=...`. The access cache is held for 60 s in Redis (`brewcc:user-access:<id>`), so wait or delete the key. |
| Every user is redirected to /pending | The backfill (`02_backfill.sql`) was not run. Run it, then wait 60 s or flush the `brewcc:user-access:*` keys. |
| A custom domain stops working after "Disable" | Admin → Domains → Enable, or re-add it in the user's workspace. |
| A user created a pending account that must be removed | Reject it in the admin panel. Do not delete rows manually. |
