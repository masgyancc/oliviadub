# BrewCC: move the app from lilac-orbit.com to brewcc.online

Decision (2 Nov 2026): the dashboard moves to `app.brewcc.online`, the API to `api.brewcc.online`, and `lilac-orbit.com` is removed right away, with no transition redirects.

| Host | Before | After |
|---|---|---|
| Dashboard | `app.lilac-orbit.com` | `app.brewcc.online` |
| API | `api.lilac-orbit.com` | `api.brewcc.online` |
| `brewcc.online` | 308 to the app | 308 to the app (unchanged) |
| `lilac-orbit.com` (+ `app.`/`api.`) | short links / app | removed from Vercel; existing links on it stop working |

Effects:
- Every user is signed out once: the session cookie moves from `.lilac-orbit.com` to `.brewcc.online`.
- Links on `lilac-orbit.com` stop resolving. Their rows stay in the database.
- Old dashboard and API URLs (bookmarks, API clients) stop working.

**Keep `assets.lilac-orbit.com`.** It is the public URL of the R2 storage bucket (`STORAGE_BASE_URL`), and uploaded images (avatars, workspace logos, link preview images) are stored in the database as full `https://assets.lilac-orbit.com/...` URLs. Removing the lilac-orbit.com zone from Cloudflare breaks all of them. Step 10 only removes the domains from Vercel; the Cloudflare zone and its `assets` record stay until the storage is moved (new R2 custom domain such as `assets.brewcc.online`, new `STORAGE_BASE_URL`, and a separately approved database update of the stored URLs).

`NEXT_PUBLIC_APP_SHORT_DOMAIN` and `NEXT_PUBLIC_DUB_DEFAULT_DOMAINS` keep their values: they are internal only (default domains aren't offered in Create Link), and the order of `NEXT_PUBLIC_DUB_DEFAULT_DOMAINS` maps to the `DefaultDomains` table columns, so changing it would shift that mapping.

## Steps

1. **Cloudflare** (zone brewcc.online), DNS only (grey cloud):
   - CNAME `app` → `cname.vercel-dns.com`
   - CNAME `api` → `cname.vercel-dns.com`
2. **Google Cloud Console** → OAuth client → Authorized redirect URIs: add `https://app.brewcc.online/api/auth/callback/google`.
3. **Vercel** → project → Domains: add `app.brewcc.online` and `api.brewcc.online`.
4. **Vercel** → Environment Variables (Production): `NEXT_PUBLIC_APP_DOMAIN=app.brewcc.online` (and `NEXTAUTH_URL=https://app.brewcc.online` if set). Redeploy, since `NEXT_PUBLIC_*` values are baked in at build time.
5. **GitHub** → OAuth App → Authorization callback URL: `https://app.brewcc.online/api/auth/callback/github`.
6. **Telegram**: register the webhook again with the new URL (see `BREWCC_TELEGRAM_BOT.md` §5).
7. **Vercel Firewall**: the challenge rule's exclusions for `app.`/`api.lilac-orbit.com` become `app.`/`api.brewcc.online`.
8. **Stripe / other webhooks**, if configured: point them at `app.brewcc.online`.
9. Check: Google and GitHub login, the dashboard, `api.brewcc.online` (401 without a key), the Telegram bot, a link on `meluncur.cc`.
10. **Vercel** → Domains: remove `app.lilac-orbit.com`, `api.lilac-orbit.com`, `lilac-orbit.com`. In Cloudflare you can delete the `@`, `app` and `api` records, but keep the zone and the `assets` record (see above).

## Rollback

Until step 10, revert `NEXT_PUBLIC_APP_DOMAIN` to `app.lilac-orbit.com` and redeploy. After step 10, add the lilac-orbit domains back to Vercel first.
