# BrewCC â€” Bulk Destination Replacement

Branch: `feature/bulk-destination-replacement`. Not merged to `main`. The migration has not been applied to production.

Replace the **destination domain** of many short links at once. Only the domain changes. Path, `?query`, `#fragment` and trailing slash are copied character-for-character.

## Rules
- Input: old and new **domain only** (`toko1a.com`, `https://www.toko1a.com/` are fine). A path, `?` or `#` in the input is rejected as ambiguous. Old and new may not be the same domain.
- Matching ignores `www.` and `http`/`https`. The port must match. Subdomains (`shop.toko1a.com`), look-alikes (`toko1a.com.evil.net`) and the old domain inside a path or query are **not** matched.
- Result = new domain exactly as typed (https if no protocol) + the original rest of the URL. A URL that would not change is skipped.
- Only the main destination (`url`) changes. iOS/Android/geo/A-B targets that still use the old domain are flagged in the preview and left as they are.
- Root domain links (`domain.com/`) are not included; they belong to domain settings.

## Ownership (server-side)
- Scope = links **created by the session user** (`Link.userId = session.user.id`) **in the current workspace** (`Link.projectId`), with workspace membership and `links.write` enforced by `withWorkspace`.
- The user id always comes from the server session. Link ids in a request are re-read through the same filter, so ids of other users' links are dropped.
- Admin rights don't widen the scope. There is no global or cross-user mode.

## Flow
1. **Preview** (`POST /api/links/bulk-replace` `{action:"preview", oldDomain, newDomain, scope:"all"|"selected", linkIds?}`): read-only. Returns checked / matched counts and old â†’ new per link.
2. **Confirm** (`{action:"apply", oldDomain, newDomain, items:[{linkId, expectedUrl}]}`): max 500 links per run. A typed count confirmation is required in the UI above 50 links. Each link is re-checked (ownership, URL unchanged since the preview, domain still matches), then updated through the dashboard pipeline (`processLink` â†’ `updateLink`: validation, Redis link cache, Tinybird metadata, webhooks). Links changed after the preview are **skipped**. A failure on one link doesn't stop the others.
3. **Result**: checked, matched, updated, skipped, failed.
4. **Undo** (`GET/POST /api/links/bulk-replace/runs`): reverts a run, but only links whose URL is still exactly what the run set. Later edits are never overwritten.

Every run and undo is recorded in `AdminAuditLog` (`links.bulk_replace`, `links.bulk_replace_undo`) with the domains and counts. Rate limit: 5 runs per minute per user.

## UI
- Links page **â‹¯ â†’ Bulk Edit â†’ Replace destination domain**: all of the user's links.
- Select links â†’ toolbar **Replace URL**: the selected links (still filtered to the user's own).
- The modal shows input, explanation with an example, the preview table, Confirm, the result summary and recent runs with **Undo**.

## Data
New table `LinkUrlReplacement` (undo history: runId, linkId, projectId, userId, oldUrl, newUrl, revertedAt, createdAt). Migration: `apps/web/prisma/brewcc-migrations/20261101_bulk_replace/01_up.sql` (additive). Rollback: `02_down.sql`.

## Files
New: `lib/bulk-replace/{replace-domain,service}.ts`, `app/api/links/bulk-replace/route.ts`, `app/api/links/bulk-replace/runs/route.ts`, `ui/modals/bulk-replace-modal.tsx`, `prisma/schema/bulk-replace.prisma`, migration SQL, `tests/bulk-replace/{replace-domain,service}.test.ts`.
Modified: `ui/links/links-toolbar.tsx` (bulk action), `app/app.dub.co/(dashboard)/[slug]/links/page-client.tsx` (â‹¯ menu entry).
Reused, not changed: `updateLinkFromBot` (lib/telegram/links.ts), the shared link-update pipeline.

## Tests (`npx vitest run tests/bulk-replace`)
- 14 URL-rule tests: fragment, path, nested path, query, combination (byte-for-byte), trailing slash, different port, http/www, look-alike hosts, domain only in path/query, already on the new domain, toko1a â†’ sepedalipat, non-http/credentials, invalid input.
- 6 service tests (mocked DB): only the session user's links in the current workspace are read, other users' and teammates' ids are ignored, an admin is scoped the same, links changed after the preview are skipped, partial failure is reported, invalid or identical domains are rejected.
- `tsc --noEmit`: 0 errors. `next build` (production): success, new routes present.

## Deploy (needs approval)
1. Apply `01_up.sql` to production **first**.
2. Push `feature/bulk-destination-replacement` â†’ `main`.
3. Test with a few links: preview, confirm, check that the redirect goes to the new domain with path, query and `#` intact, then Undo.
