# BrewCC — Telegram Bot

Branch: `feature/brewcc-telegram-bot`. Not merged to `main` and not deployed.

The bot is an additional interface to BrewCC. It uses the same PlanetScale database, BrewCC accounts, workspace ownership, link logic and Tinybird analytics as the dashboard. Every change made in Telegram appears in the dashboard immediately, because it is the same data.

## 1. Audit summary (what is reused)
| Need | Existing BrewCC code reused |
|---|---|
| Approved / pending / suspended | `lib/auth/platform-access.ts` (`getUserAccess`, 60 s Redis cache, invalidated on status change) |
| Workspace membership + role permissions | Same query and `getPermissionsByRole` as `withWorkspace` (`lib/auth/workspace.ts`) |
| Ownership of a link | `getLinkOrThrow({ workspaceId, linkId })` + `verifyFolderAccess` |
| List links | `getLinksQuerySchemaExtended` + `getFolderIdsToFilter` + `getLinksForWorkspace` (as `GET /api/links`) |
| Create link | `throwIfLinksUsageExceeded` → `createLinkBodySchemaAsync` → `processLink` → `createLink` → `sendWorkspaceWebhook` (as `POST /api/links`) |
| Edit link | `updateLinkBodySchemaExtended` → `processLink` → `updateLink` → webhook (as `PATCH /api/links/[linkId]`) |
| Delete link | root-link guard → `deleteLink` → webhook (as `DELETE /api/links/[linkId]`) |
| Available domains | Workspace domains + shared domain pool (`getSharedDomains`) + enabled default domains |
| Analytics | `parseAnalyticsQuery` + `getAnalytics` (Tinybird), the same path as `GET /api/analytics` |
| Sessions, rate limits, dedupe | Upstash Redis (`redis`, `ratelimit`) |
| Audit log | `AdminAuditLog` (`telegram.connect`, `telegram.disconnect`) |

**"My links"** means the links of the user's workspace, the same set the dashboard shows. A user in several workspaces can switch between them in the bot. The user's workspace role and folder permissions apply.

## 2. Files
New:
- `apps/web/prisma/schema/telegram.prisma`: `TelegramAccount`, `TelegramLinkToken`
- `apps/web/prisma/brewcc-migrations/20261101_telegram/{01_up,02_down}.sql`
- `apps/web/lib/telegram/{config,api,format,linking,session,context,links,analytics,bot}.ts`
- `apps/web/app/api/telegram/webhook/route.ts`: Telegram webhook
- `apps/web/app/api/user/telegram/route.ts`: status / create link token / disconnect
- `apps/web/app/app.dub.co/(dashboard)/account/settings/telegram/{page,page-client}.tsx`

Modified: `apps/web/ui/layout/sidebar/app-sidebar-nav.tsx` (adds the "Telegram" item under Settings → Account).

No dependencies added. The Telegram Bot API is called with `fetch`.

## 3. Database (additive only)
`01_up.sql` creates two tables and touches no existing table:
- `TelegramAccount` (`userId` unique, `telegramId` unique, `telegramUsername`, `connectedAt`, `lastInteractionAt`)
- `TelegramLinkToken` (`userId`, `tokenHash` unique (SHA-256), `expiresAt`, `usedAt`, `createdAt`)

Apply it **before** deploying the code (`prisma db execute --file … --url …`). Rollback: `02_down.sql`, only after the code without the bot is live again.

## 4. Environment variables (set in Vercel, never in Git/chat)
| Variable | Required | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | Token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | yes | Random string (1–256 chars, `A-Z a-z 0-9 _ -`), sent by Telegram in `X-Telegram-Bot-Api-Secret-Token` |
| `TELEGRAM_BOT_USERNAME` | yes | Bot username without `@` (used for the `t.me` deep link) |
| `TELEGRAM_TIMEZONE` | no | Day boundary for Today/Yesterday, default `Asia/Jakarta` |

Without the three required variables, the webhook returns 404 and the dashboard shows "not configured".

## 5. Registering the webhook (once, after deploy)
Run this from your own terminal. The token stays on your machine:
```powershell
$token = Read-Host "Bot token"; $secret = Read-Host "Webhook secret"
Invoke-RestMethod -Method Post "https://api.telegram.org/bot$token/setWebhook" -Body @{ url = "https://app.brewcc.online/api/telegram/webhook"; secret_token = $secret; allowed_updates = '["message","callback_query"]'; drop_pending_updates = "true" }
```
Check with `getWebhookInfo`. `app.brewcc.online/api/*` is excluded from the Vercel Firewall challenge rule, so Telegram can reach the webhook.

## 6. Security
- Webhook: secret header checked with `timingSafeEqual` → 401 otherwise. Each `update_id` is processed once (Redis `SET NX`, 1 h).
- Only private chats are answered, so links and stats never appear in groups.
- Every update is re-authorized: the Telegram user id must be linked, and the BrewCC account must be **approved** right now. Pending, rejected, suspended and unlinked users get a short message and nothing else. A suspension takes effect within the 60 s access cache, or immediately, since admin actions invalidate it.
- Every link action re-checks workspace membership, role permission (`links.read`, `links.write`, `analytics.read`), link ownership (`getLinkOrThrow` with the workspace id) and folder access. Callback data is never trusted. The workspace switch only accepts workspaces the user belongs to.
- Delete requires two steps. The confirm callback is only accepted right after the warning step for the same link.
- Linking tokens: 32 random bytes, only the SHA-256 hash is stored, 5-minute expiry, single use (atomic claim), the newest token replaces older ones, 5 tokens per 10 minutes per user. One Telegram id can be linked to only one BrewCC account. Disconnect from the dashboard.
- Rate limits: 30 updates/min per Telegram user, 10 analytics requests/min.
- Errors: validation messages from BrewCC are shown; anything else returns a generic message (details only in server logs). Tokens and secrets never appear in messages or logs.

## 7. Bot menu
Main menu: List · Add · Edit · Delete · Tracking & Analytics · Switch workspace (if more than one) · Refresh.
- **List**: 5 per page, Next/Prev, search by slug/URL, domain filter, tap a link for Detail (Edit / Delete / Analytics).
- **Add**: domain → destination URL → custom slug (`-` = random) → title (`-` = skip) → preview → Confirm.
- **Edit**: URL / slug / domain / title → preview (old → new) → Confirm / Cancel.
- **Delete**: info + warning → Confirm Delete / Cancel.
- **Analytics**: Today, Yesterday, Last 7 days, Last 30 days and All time, for the workspace or per link. Unique clicks are not shown because the existing pipeline has no unique-click metric.

## 8. Test checklist (staging / after deploy)
- [ ] Approved user connects (dashboard → Settings → Telegram → Connect → Start) → "Connected"
- [ ] Same deep link a second time → "already used"; after 5 min → "expired"
- [ ] Second BrewCC account with the same Telegram → "already linked to another account"
- [ ] Pending / rejected / suspended / unlinked → access denied; suspend a connected user → next tap denied
- [ ] List, pagination, search, domain filter show only own workspace links
- [ ] Add (own, shared and default domain), slug collision → error from BrewCC validation
- [ ] Edit URL / slug / domain / title → visible in the dashboard
- [ ] Delete needs Confirm. A forged `xy:` callback without the warning step is ignored
- [ ] Analytics numbers match the dashboard for the same range
- [ ] Re-sent update (same `update_id`) is processed once; webhook without the secret → 401
- [ ] Dashboard, existing links, admin panel, custom domains unaffected
