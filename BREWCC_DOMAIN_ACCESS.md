# BrewCC — Domain Management & Access Control

Branch: `feature/domain-access-control`. The app domain does **not** change: the dashboard stays on `app.lilac-orbit.com` and no env vars, DNS or auth settings were touched.

## Rules
| Request | Result |
|---|---|
| `app.lilac-orbit.com/...` | BrewCC app (unchanged) |
| `meluncur.cc/abc123` (valid slug) | Redirect to the destination (unchanged) |
| `meluncur.cc` (no slug) | Generic 404 |
| `meluncur.cc/slug-random` (unknown slug) | Generic 404 |
| `meluncur.cc/login`, `/register`, `/stats/...`, `/brand/...`, `/legal/...`, `slug+`, `/https://...`, `*.php` | Generic 404 |
| Disabled, banned or expired link (no expiration URL) | Generic 404 |

The same applies to `lilac-orbit.com` and `brewcc.online`, which are short-link hosts, not app hosts.

The generic 404 is self-contained HTML: "404 - Page Not Found / The page you are looking for doesn't exist or has been moved." It has an HTTP status of **404**, no logo, no name, no links, no scripts and no `x-powered-by` header. It is not cached, so a newly created link works immediately.

The following are no longer served on short-link domains: the root-domain placeholder, the root redirect, each domain's "Not Found URL" redirect, and the Dub "Link not found", expired, disabled and inspect pages. These are unchanged: password-protected links, expired links with an expiration URL, ads tracking, and `/.well-known` files.

## Short-link domains
- New links can only be created on **verified custom domains**: the workspace's own domains plus the shared pool, which still works as before. `lilac-orbit.com` and `brewcc.online` are not shown in Create Link and are rejected by the server (dashboard, API, Telegram bot, bulk and import).
- **Unverified** domains can't be used until DNS verification passes.
- Existing links keep working, including `lilac-orbit.com/3B971vh`. Editing a link without changing its domain or key is allowed.

## Allow Users to Add Domains
**Admin → Settings → Domain Settings**: an ON/OFF toggle, **OFF by default**.
- It is stored in the `PlatformSetting` table and read from the database on every check, so changes apply immediately and survive restarts or redeploys.
- **OFF**: users can't add domains. The "Add custom domain" and "Add Domain" buttons are disabled and show the message *Custom domain registration is currently disabled by administrator.*
- Server side, the same check runs on every endpoint that can add a domain:
  - `POST /api/domains`
  - domain rename (`PATCH /api/domains/[domain]`)
  - Bitly, Rebrandly and Short.io imports (when they would add new domains)
  - CSV import (new domains are skipped)
  - `.link` registration
- **Master admins are always allowed.** Existing domains are never removed and stay usable by everyone.
- Every toggle change is written to the Audit Log as `settings.allow_user_domains`.

## Data
New table `PlatformSetting` (key, value, updatedById, updatedAt). Migration `apps/web/prisma/brewcc-migrations/20261101_platform_settings/01_up.sql` (additive), rollback `02_down.sql`. A missing row means OFF.

## Files
New:
- `lib/brewcc/platform-settings.ts`
- `lib/middleware/utils/generic-not-found.ts`
- `app/api/domains/add-permission/route.ts`
- `lib/swr/use-add-domain-permission.ts`
- `app/app.dub.co/(admin)/admin/settings/{page,allow-user-domains-toggle}.tsx`
- `tests/domain-access/*`

Modified:
- `middleware.ts`
- `lib/middleware/link.ts`
- `lib/api/links/process-link.ts`
- `ui/links/use-available-domains.ts`
- `ui/modals/add-edit-domain-modal.tsx`
- `settings/domains/page-client.tsx`
- the domain and import routes
- `lib/actions/admin/admin-actions.ts`
- `admin-nav.tsx`
- `prisma/schema/admin.prisma`

## Tests (`npx vitest run tests/domain-access`)
- Settings:
  - default OFF;
  - OFF blocks users with the administrator message;
  - master admin is always allowed;
  - ON allows users;
  - the value is persisted.
- Links:
  - default domains are rejected for new links;
  - editing an existing link on a default domain is allowed;
  - unverified domains are rejected;
  - verified domains work.
- Routing (the real middleware):
  - custom domain root → 404;
  - unknown slug → 404;
  - valid slug → 302 to the destination;
  - login, register, stats, brand, legal, inspect, URL-as-slug and `.php` → 404;
  - the 404 contains no BrewCC, Dub, login or sign-up text and no links or scripts;
  - the app host still serves the app and `/brand` files.

## Deploy (needs approval)
1. Apply `01_up.sql` to production **first**.
2. Push `feature/domain-access-control` → `main`.
3. Check with curl:
   - `meluncur.cc` → 404;
   - `meluncur.cc/xyz-random` → 404;
   - `meluncur.cc/tes` → 302;
   - `app.lilac-orbit.com/login` → login page.
4. Admin → Settings: the toggle shows OFF. As a normal user, Add Domain is disabled.
