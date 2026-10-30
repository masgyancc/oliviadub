# Checklist Deploy Dub (self-host di Vercel)

> **STATUS 30 Okt 2026, 21:37 WIB: LIVE.** https://app.lilac-orbit.com (login
> GitHub), https://api.lilac-orbit.com, link pendek di https://lilac-orbit.com.
> Deployment pertama yang sukses: commit `29bbc06` (Vercel Pro, mesin Standard
> 8 GB, `experimental.cpus: 2` + typecheck/lint dilewati). Repo:
> https://github.com/oliviaevergarden44-a11y/oliviadub (push ke `main` = deploy).
> Belum diuji: login, buat link, redirect, analytics, upload gambar ke R2.

Status: repo sudah di-clone dan di-patch supaya domain bisa diatur lewat env.
File `apps/web/.env` sudah dibuat dengan secret acak. Sisanya butuh akun di
layanan di bawah ini. Isi nilainya ke `apps/web/.env`, lalu nanti disalin ke
Vercel → Settings → Environment Variables.

Jangan commit `apps/web/.env` (sudah di-ignore git).

---

## 0. Domain (wajib, sebelum apa pun)

Setelah domain dibeli, ganti di `apps/web/.env`:

| Variabel | Contoh | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_APP_DOMAIN` | `app.lilac-orbit.com` | host dashboard, tanpa `https://` |
| `NEXT_PUBLIC_APP_SHORT_DOMAIN` | `lilac-orbit.com` | domain link pendek default |
| `NEXTAUTH_URL` | `https://app.lilac-orbit.com` | pakai `https://` |

Host API otomatis jadi `api.lilac-orbit.com` (mis. `api.acme.com`). Cookie login dipasang
di `.lilac-orbit.com` (mis. `.acme.com`), jadi dashboard dan API harus satu root domain.

DNS yang nanti diarahkan ke Vercel: `app.lilac-orbit.com`, `api.lilac-orbit.com`, dan domain pendek.

---

## 1. Tinybird (analytics klik)  — https://www.tinybird.co

**Status 30 Okt 2026: SELESAI.** Workspace Forward di `aws-eu-central-1`,
`TINYBIRD_API_URL=https://api.eu-central-1.aws.tinybird.co`, deployment #1
done (14 datasource, 32 pipe). Catatan CLI: `pip install tinybird-cli` adalah
CLI **Classic** dan tidak bisa dipakai untuk workspace Forward. Forward CLI
(`pip install tinybird`) terpasang di venv `.tbvenv/` (git-excluded). Deploy
ulang kalau file `packages/tinybird` berubah:

```bash
cd packages/tinybird && PYTHONIOENCODING=utf-8 ../../.tbvenv/Scripts/tb.exe --cloud --host https://api.eu-central-1.aws.tinybird.co --token "$TINYBIRD_API_KEY" deploy
```

Langkah awal (sudah dikerjakan, disimpan untuk referensi):

1. Buat Workspace (region bebas, catat regionnya).
2. Tokens → salin **admin** token → `TINYBIRD_API_KEY`.
3. Set `TINYBIRD_API_URL` sesuai region, mis.
   `https://api.us-east.aws.tinybird.co` atau `https://api.europe-west2.gcp.tinybird.co`.
4. Deploy skema (CLI `tb` sudah terpasang di PC ini):

```bash
tb login
```

```bash
cd packages/tinybird && tb --cloud deploy
```

## 2. Upstash (Redis + QStash) — https://console.upstash.com

Redis:
1. Create Database → pilih **Global** (read region terdekat ke user).
2. Tab REST API → `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

QStash:
1. Menu QStash → Request Builder.
2. Salin `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
3. `QSTASH_URL` biarkan default.

## 3. MySQL — PENTING, baca dulu

Dub memakai **dua** jalur ke database:

1. Prisma biasa (`DATABASE_URL`, protokol MySQL/TCP) → semua API dashboard.
2. Driver HTTP `@planetscale/database` (`PLANETSCALE_DATABASE_URL`, fallback ke
   `DATABASE_URL`) → **redirect link di middleware**, cek workspace default,
   halaman password, OG image.

Jalur ke-2 hanya bisa bicara ke PlanetScale asli atau ke **ps-http-sim**
(simulator HTTP PlanetScale di depan MySQL biasa). MySQL polos di Railway
**tidak cukup**: dashboard jalan, tapi redirect link akan gagal.

**Keputusan (30 Okt 2026): pakai PlanetScale.** Dibuat: database `oliviadbdub`,
PS-10, region **AWS eu-central-1 (Frankfurt)**. Konsekuensi region, supaya
latensi kecil: Vercel Function Region → **fra1**, Tinybird workspace → region
**EU** (`https://api.europe-west2.gcp.tinybird.co` atau eu-central-1 AWS),
Upstash Redis global dengan primary **eu-central-1**.

- **A. PlanetScale** ← dipilih
  1. https://app.planetscale.com → New database → nama `dub`, region terdekat
     ke region Vercel (mis. `ap-southeast-1`), pilih plan termurah.
  2. Setelah aktif → tab **Connect** → "Create password" → framework **Prisma**.
  3. Salin `DATABASE_URL` yang muncul (format
     `mysql://user:pw@aws.connect.psdb.cloud/dub?sslaccept=strict`) ke `.env`.
  4. `PLANETSCALE_DATABASE_URL` biarkan kosong (driver HTTP otomatis memakai
     `DATABASE_URL`).
  5. Settings → pastikan "Allow web console" tidak diperlukan; foreign key
     constraints tidak perlu diaktifkan (Prisma `relationMode = "prisma"`).
- **B. MySQL + ps-http-sim di VPS sendiri** (tidak dipilih, disimpan sebagai cadangan):
  - MySQL 8 di VPS, buka port hanya untuk Vercel (atau pakai TLS + password kuat).
  - Jalankan `ghcr.io/mattrobenolt/ps-http-sim` (Docker) yang menunjuk ke MySQL
    tsb, di belakang reverse proxy HTTPS (Caddy) di `ps.lilac-orbit.com`.
  - `DATABASE_URL=mysql://user:pass@<ip-vps>:3306/dub`
  - `PLANETSCALE_DATABASE_URL=https://user:pass@ps.lilac-orbit.com`
  - Catatan: ps-http-sim dibuat untuk dev lokal, bukan produksi. Cukup untuk
    trafik kecil, tapi tidak ada jaminan dari PlanetScale.

Setelah `DATABASE_URL` terisi, jalankan dari folder `apps/web`:

```bash
pnpm run prisma:generate
```

```bash
pnpm run prisma:push
```

## 4. Login provider — minimal satu

- **GitHub OAuth** (gratis): GitHub → Settings → Developer settings → OAuth Apps → New.
  Callback URL: `https://app.lilac-orbit.com/api/auth/callback/github`
  → `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
- **Google OAuth** (opsional): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  callback `https://app.lilac-orbit.com/api/auth/callback/google`.
- **Email magic link** butuh Resend (poin 6).

## 5. Storage gambar — Cloudflare R2 (atau S3)

Status 30 Okt 2026: akun Cloudflare (zone lilac-orbit.com) **belum mengaktifkan
R2** (API balas `10042: Please enable R2 through the Cloudflare Dashboard`).
Aktifkan dulu di https://dash.cloudflare.com → R2 Object Storage → Enable R2
(butuh setuju ToS; free tier 10 GB, kartu diminta hanya untuk overage).
Setelah itu Claude bisa buat bucket lewat MCP. Pemasangan custom domain
`assets.lilac-orbit.com` mengubah DNS, jadi perlu izin eksplisit.

1. R2 → Create bucket, contoh nama `dubassets` (publik) dan `dubassets-private`.
2. Manage R2 API Tokens → Create → **Object Read & Write**, scope ke bucket tsb.
   → `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`.
3. `STORAGE_ENDPOINT` = S3 API endpoint bucket (`https://<account_id>.r2.cloudflarestorage.com`).
4. Bucket publik → Settings → Public access: aktifkan R2.dev subdomain **atau**
   pasang custom domain (mis. `assets.lilac-orbit.com`). URL itu → `STORAGE_BASE_URL`.
5. `STORAGE_PUBLIC_BUCKET=dubassets`, `STORAGE_PRIVATE_BUCKET=dubassets-private`.

## 6. Resend (email, opsional tapi disarankan) — https://resend.com

1. API Keys → Create → `RESEND_API_KEY`.
2. Domains → tambah `lilac-orbit.com` → pasang record DNS yang diminta → Verify.

## 6a. Versi Node: WAJIB 22.x

`next build` gagal di Node 25 (`SlowBuffer` dihapus; dipakai
`buffer-equal-constant-time` lewat `jsonwebtoken`/saml-jackson). Sudah dipin:
`apps/web/package.json` → `"engines": { "node": "22.x" }` dan `.nvmrc` = 22.
Di Vercel pastikan Settings → General → Node.js Version = **22.x**.
Build lokal di PC ini (Node 25) pakai `npx -y -p node@22 -- pnpm run build`.

## 6c. Upstash Vector (internal dub.co, wajib placeholder)

`lib/upstash/vector.ts` membuat client Vector saat modul di-load dan throw kalau
token kosong. Di `.env` sudah diisi placeholder
(`UPSTASH_VECTOR_REST_URL=https://placeholder-vector.upstash.io`,
`UPSTASH_VECTOR_REST_TOKEN=placeholder`). Paste yang sama ke Vercel. Fitur
pencarian docs/help center tidak dipakai di self-host.

## 6d. OOM di build Vercel (Hobby, mesin "basic")

Deploy pertama (30 Okt 2026) gagal: webpack selesai 6 menit, lalu tahap
"Linting and checking validity of types" dibunuh SIGKILL (Out of Memory), dan
`.next/routes-manifest.json` tidak pernah terbentuk. Fix: `next.config.js`
`typescript.ignoreBuildErrors` + `eslint.ignoreDuringBuilds` = true. Jalankan
typecheck lokal sebelum push: `cd apps/web && npx tsc --noEmit`.

## 6b. Stripe (tidak dipakai, tapi wajib ada nilai)

`lib/stripe/index.ts` membuat client Stripe saat modul di-load, jadi build
gagal kalau `STRIPE_SECRET_KEY` kosong. Di `.env` sudah diisi placeholder
(`sk_test_placeholder` dkk.). Paste placeholder yang sama ke Vercel. Fitur
billing tidak akan dipakai di instance self-host.

## 0b. Domain link pendek tambahan: brewcc.online (30 Okt 2026)

Keputusan: DNS dipindah ke **Cloudflare**. Zone sudah dibuat via API
(id `c03affcf65ced32f8dd823cf2411d512`, status pending, 0 record).
1. Namecheap → Domain List → brewcc.online → Nameservers: **Custom DNS** →
   `ace.ns.cloudflare.com` dan `maisie.ns.cloudflare.com`. Propagasi sampai 24 jam,
   biasanya < 1 jam; zone di Cloudflare berubah dari pending ke active.
2. Cloudflare → brewcc.online → DNS → Add record: **A `@` → `216.198.79.1`,
   Proxy status DNS only**. (Classifier menolak Claude menambah DNS record.)
3. Dashboard app.lilac-orbit.com → workspace → **Domains** → Add domain →
   `brewcc.online` → Verify. Dub mendaftarkannya ke project Vercel via API dan
   Vercel menerbitkan sertifikat.

## 7a. DNS Cloudflare untuk Vercel (status 30 Okt 2026: belum dipasang)

Project Vercel `dub` (prj_PNHaHemtJvWHGHyLmiEhtzMfOnV9, team olivia-18ea)
sudah dibuat via API: root `apps/web`, Node 22.x, region fra1, 33 env production.
Tiga domain sudah didaftarkan ke project. Record DNS yang diminta Vercel
(pasang di Cloudflare → DNS, **Proxy status: DNS only / awan abu-abu**):

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `app` | `b271e7123c379a57.vercel-dns-017.com` | DNS only |
| CNAME | `api` | `b271e7123c379a57.vercel-dns-017.com` | DNS only |
| A | `@` | `216.198.79.1` | DNS only |

Jangan proxied (awan oranye): Vercel sudah terminasi TLS sendiri, proxy
Cloudflare di atasnya memicu redirect loop/sertifikat gagal.

## 7. Vercel — https://vercel.com

1. Push repo ini ke GitHub **public** (lisensi AGPLv3 mewajibkan source terbuka).
2. Vercel → Add New Project → import repo:
   - Framework Preset: **Next.js**
   - Root Directory: **`apps/web`**
3. Environment Variables: paste isi `apps/web/.env`, **kecuali**:
   - `NEXT_PUBLIC_VERCEL_ENV` — jangan dipaste, Vercel mengisinya sendiri
     (pastikan Settings → Environment Variables → "Automatically expose System
     Environment Variables" ON).
   - `VERCEL_PROJECT_ID` — isi setelah deploy pertama (Settings → General → Project ID).
   - `TEAM_ID_VERCEL` — Settings → General → Team ID.
   - `VERCEL_API_KEY` — Account Settings → Tokens → Create (scope: team ini).
4. Deploy. Setelah sukses, Settings → Domains: tambah `app.lilac-orbit.com`, `api.lilac-orbit.com`,
   dan domain pendek. Ikuti instruksi DNS Vercel.
5. Isi `VERCEL_PROJECT_ID`, lalu **Redeploy**.

Catatan: `apps/web/vercel.json` (11 cron) **dikembalikan** setelah upgrade ke Pro (30 Okt 2026); Hobby hanya mengizinkan 2 cron/hari.
Tanpa cron, statistik klik per link dan usage workspace tidak ter-update
otomatis. Kalau nanti dibutuhkan, cron bisa dipasang ulang lewat QStash Schedules
yang memanggil `https://app.lilac-orbit.com/api/cron/...` dengan header
`Authorization: Bearer <CRON_SECRET>`.

---

## Yang sudah di-patch di repo (biar tahu kalau nanti rebase ke upstream)

| File | Perubahan |
|---|---|
| `packages/utils/src/constants/main.ts` | `APP_HOSTNAME`, `SHORT_DOMAIN`, `API_HOSTNAME`, `COOKIE_DOMAIN`, `IS_DUB_CO` dibaca dari env |
| `packages/utils/src/constants/middleware.ts` | `DEFAULT_REDIRECTS` ikut `APP_DOMAIN` |
| `packages/utils/src/constants/dub-domains.ts` | instance self-host hanya expose `SHORT_DOMAIN`, bukan chatg.pt dkk. |
| `apps/web/lib/auth/options.ts` | cookie domain `.dub.co` → `COOKIE_DOMAIN` |
| `apps/web/app/api/domains/default/route.ts` | kolom `dubsh` dipetakan ke `SHORT_DOMAIN` (schema Prisma tidak perlu diubah) |
| `apps/web/lib/api/links/process-link.ts`, `utils/key-checks.ts` | fallback domain `"dub.sh"` → `SHORT_DOMAIN` |
| `apps/web/ui/links/use-available-domains.ts` | urutan domain default pakai `SHORT_DOMAIN` |
| `apps/web/next.config.js` | host `STORAGE_BASE_URL` diizinkan untuk `next/image` |
| `apps/web/vercel.json` | dihapus (cron) |

| `apps/web/app/[domain]/{page,notfound,expired,banned,disabled}/page.tsx` | tombol "Try Dub today" → `${APP_DOMAIN}/register` |
| `packages/ui/src/nav/nav.tsx` | Log in / Sign up → `APP_DOMAIN`; cek sesi juga di `ROOT_DOMAIN` |

Yang **tidak** di-patch: teks/link di template email, menu marketing Nav
(Product/Solutions/Pricing → dub.co), dan "Learn more". Kosmetik saja.
