# BrewCC — Custom Domain & Cloudflare Setup

## Decision
BrewCC runs on **Vercel**. Custom domains use **Vercel Domains**, which Dub already integrates, instead of Cloudflare for SaaS (approved by the owner on 2026-10-31). Reasons:
- Vercel already provides per-hostname routing, ownership verification and automatic SSL (Let's Encrypt). Cloudflare for SaaS would add a second proxy/TLS layer in front of Vercel, which Vercel advises against.
- No extra cost, no Cloudflare token, no change to `brewcc.online` or `lilac-orbit.com` DNS.
- Users keep their domain in their **own** Cloudflare (or any DNS provider) and never share credentials with BrewCC.

## How it works (no .env edit, no redeploy, no admin action)
1. The user opens **Settings → Domains → Add Domain** and enters `go.example.com` or `example.com`.
2. BrewCC validates the hostname: format, not already claimed by anyone, not a platform domain (`lilac-orbit.com`, `brewcc.online`, `*.vercel.app` ...), rate limited to 10 per workspace per hour.
3. BrewCC adds the hostname to the Vercel project through the Vercel API and stores it in the `Domain` table (owned by the workspace, `verified = false`).
4. The dashboard shows the DNS records to create, each with a Copy button:
   | Domain type | Record |
   |---|---|
   | Subdomain (`go.example.com`) | `CNAME go → cname.vercel-dns.com` |
   | Apex (`example.com`) | `A @ → 76.76.21.21`, or on Cloudflare a `CNAME @ → cname.vercel-dns.com` (CNAME flattening) |
   | If the domain is already used in another Vercel account | an extra `TXT _vercel → vc-domain-verify=...` shown by BrewCC |
5. Verification runs automatically: hourly via the cron `/api/cron/domains/verify`, and every time the user opens or refreshes the domain card (limited to 30 checks per minute). The status comes from Vercel's authoritative config API, not a generic DNS checker.
6. When the records are correct, the domain becomes **Valid Configuration / active**, Vercel issues the certificate, and the domain appears in the link builder.

### Cloudflare users: important
- Set the record's proxy status to **DNS only (grey cloud)**. An orange-cloud (proxied) record blocks Vercel from issuing the certificate. The BrewCC UI shows this hint under the DNS records.
- An apex domain on Cloudflare can use the CNAME at `@`; Cloudflare flattens it automatically.

## Admin
**Admin → Domains** lists every custom domain with workspace, owner, status, date added and last check.
- **Disable**: removes the hostname from Vercel, so all traffic and links on it stop. Logged in the audit log.
- **Enable**: adds it back. It becomes active again after the next successful verification.
- **Delete**: same flow as a user deleting their domain (a background job removes links and the Vercel hostname).

## Known limits
- The domain is marked active when Vercel reports a valid configuration. Certificate issuance follows within seconds to a few minutes, and HTTPS may briefly show an error during that window.
- Vercel Pro allows a large number of domains per project. Check the Vercel limits if the platform grows past thousands of domains.
- The current production DNS of `brewcc.online` / `lilac-orbit.com` is untouched.
