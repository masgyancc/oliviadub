# BrewCC — Upstream references removed

Branch: `feature/remove-dub-references`. UI and API no longer link to, load from or mention the upstream project. There are no database or env changes.

## What changed
- **Help, docs and marketing links (~230):** removed. "Learn more" links are deleted, links inside sentences become plain text, and tooltip markdown links become text. Removed sections:
  - "Additional resources" (invite page and onboarding success page);
  - "Developer guides" (Tracking settings);
  - Contact sales / enterprise buttons;
  - the inspect page's abuse-report link.
- **Images:** `assets.dub.co` and `dubassets.com` are now served through BrewCC's own host (`/_proxy/assets/…`, `/_proxy/files/…`, rewrites in `next.config.js`), so browsers never request a third-party domain.
- **Avatars and QR codes:** generated through BrewCC's own API host (`OG_AVATAR_URL` and `qrCode` use `API_DOMAIN`). Old stored avatar URLs are still recognised.
- **API errors:** no more `doc_url` pointing to upstream docs. "Learn more: https://d.to/…" is removed from messages and schema descriptions.
- **Headers:** `x-powered-by: Dub …` is removed from short-link responses.
- **Sidebar:** the upstream news feed, help button, changelog popup and year-in-review card are removed. The public share dashboard and short-domain pages no longer render the upstream marketing nav/footer.
- **Wording:** the remaining visible "Dub" text in import modals, the domain tooltip, pricing copy and notification settings now says BrewCC.

## Still present (not visible to users)
- Internal identifiers: package names (`@dub/…`), cookie names (`dub_id_…`), the `app.dub.co` route folder name and code comments.
- Server-side config: SAML/SCIM (`jackson.ts`), OpenAPI/MCP document metadata, AI docs indexing, `IS_DUB_CO` checks.
- **Conversion tracking:** the client script lives on the upstream CDN (`dubcdn.com`) and is detected by that URL. The Tracking settings prompt still shows that script URL. To remove it, the script would need to be self-hosted, or the Tracking page hidden.

## Files
- Codemods: about 160 files edited in `apps/web/{app,ui,lib}` and `packages/{ui,utils}/src`.
- Deleted (unused): `enterprise-link.tsx`, `help-button.tsx`, `news.tsx`, `news-rsc.tsx`, `changelog-popup.tsx`, `year-in-review-card.tsx`, `get-content-api.ts`.
