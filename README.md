# QRSathi — Universal QR Code & Barcode Platform for India

A full-stack QR code and barcode platform:
- 26 QR content types, plus a dedicated **UPI payment QR** generator with printable standees.
- A customization studio, dynamic (editable) QR codes with scan analytics, and hosted landing pages.
- A **barcode generator** (21 symbologies) and a **universal camera/image scanner** (QR + 1D + 2D).
- **Products & inventory** with stock movements and label printing.
- Bulk generation from CSV/Excel, user accounts and an admin dashboard.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma · SQLite/PostgreSQL**.

---

## Quick start

Requirements: **Node.js 20+** (tested on 22).

```bash
cd qrsathi
npm install                 # runs `prisma generate` and copies the scanner's WebAssembly file to public/zxing/
cp .env.example .env        # then edit AUTH_SECRET and ADMIN_EMAILS
npx prisma db push          # creates/updates the SQLite database (prisma/dev.db) — additive, keeps data
npm run dev                 # http://localhost:3000
```

**Upgrading an existing install** (adds the products/inventory tables without touching existing data):

```bash
# stop any running dev server first (Windows locks Prisma's engine file while it runs)
cp prisma/dev.db prisma/dev.db.backup   # optional safety copy
npm install
npx prisma db push
npm run dev
```

Sign up with an email listed in `ADMIN_EMAILS` to get the admin panel at `/admin`.

### Optional demo data

Set `DEMO_MODE="true"` in `.env`, then:

```bash
npm run seed:demo
```

This creates `demo@demo.local / demo12345` (Pro plan) with sample QR codes and ~1,000 sample scans. If `admin@demo.local` is in `ADMIN_EMAILS` it also creates `admin@demo.local / admin12345`. Every demo record is flagged `isDemo` and labelled **Demo** in the UI and CSV exports. The script refuses to run unless `DEMO_MODE` is `true`. Never enable it in production.

### Production build

```bash
npm run build
npm start                   # serves on port 3000
```

### Tests

```bash
npm test                 # test:qr + test:barcodes (no server needed)
npm run typecheck

# Integration + browser tests need a running server:
npm run build && npm start                      # terminal 1 (port 3000)
BASE_URL=http://localhost:3000 npm run test:api      # terminal 2
BASE_URL=http://localhost:3000 npm run test:browser  # needs Edge or Chrome installed
```

On Windows PowerShell set the variable with `$env:BASE_URL="http://localhost:3000"; npm run test:api`.

| Suite | What it verifies |
|---|---|
| `test:qr` | Every QR module/eye style, frame, gradient and logo, plus all 26 content types, rendered and decoded back with jsQR. UPI URI round-trip and rejection of invalid UPI input. |
| `test:barcodes` | Check-digit maths (EAN/UPC/ITF-14/ISBN/ISSN/UPC-E) and valid/invalid input for every format. **Every format rendered to SVG and PNG and decoded with zxing-wasm (the app's own scanner).** Labels stay scannable. Multiple codes in one image, including the strip pass and its misread guard. Existing QR and UPI codes decode with the new scanner. Lookup normalisation, internal numbers in restricted ranges, PDF export. |
| `test:api` | Auth required (401) and cross-site requests blocked. Product CRUD and validation, duplicate SKU/barcode (incl. UPC-A vs EAN-13 equivalence), barcode lookup, stock in/out/adjust incl. over-withdrawal. Activity history. Isolation between users (404). Archive/delete and CSV/XLSX-style import with duplicates and errors. Inventory summary. Regression checks on UPI, dynamic QR redirects and page access. Creates and deletes its own test users. |
| `test:browser` | Headless Edge/Chrome via the DevTools protocol. **Camera scanning** with a fake webcam showing EAN-13, Code 128, QR and Data Matrix. **Image upload** with 4 codes in one image (EAN-13, Code 39, UPI QR, PDF417). Checks on-device scan history. |

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | `file:./dev.db` for SQLite, or a Postgres URL |
| `AUTH_SECRET` | ✅ | ≥32 random chars; signs sessions and salts the scan visitor hash. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL. **Dynamic QR codes encode short links on this domain** — keep it stable |
| `ADMIN_EMAILS` | ✅ | Comma-separated emails that become admins on sign-up/login |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Enables "Continue with Google" |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | – | Password-reset emails. Without SMTP, reset links print to the server console **in development only** |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | – | Paid plans via Razorpay Payment Links. Without them, "Upgrade" explains that billing isn't configured and admins assign plans manually |
| `UPLOAD_DIR` | – | Folder for uploaded files (default `./uploads`, outside `public/`) |
| `DEMO_MODE` | – | `"true"` allows `npm run seed:demo` |
| `NEXT_DIST_DIR` | – | Alternative build folder (lets a dev server and a test production build coexist) |

### Google login

1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application).
2. Authorized redirect URI: `{NEXT_PUBLIC_APP_URL}/api/auth/google/callback`.
3. Put the client ID and secret into `.env`.

### Razorpay billing

1. Add the API keys to `.env`.
2. Razorpay Dashboard → Webhooks → URL `{NEXT_PUBLIC_APP_URL}/api/billing/webhook`, event **`payment_link.paid`**, secret = `RAZORPAY_WEBHOOK_SECRET`.
3. A plan is upgraded **only** when a webhook with a valid HMAC signature confirms a fully paid link. Paid plans are 30-day passes and fall back to Free when they lapse. Prices and limits live in `src/lib/plans.ts`.

---

## Deploying

The app is a standard Next.js server. Pick one of these setups:

**A. VPS / container (simplest, keeps SQLite + local uploads).** Run `npm run build && npm start` behind Nginx/Caddy with HTTPS, under `pm2` or systemd. Back up `prisma/dev.db` and `uploads/`.

**B. Serverless (Vercel, etc.).** The filesystem there is ephemeral, so:
- Use **PostgreSQL** (Supabase, Neon, RDS): set `provider = "postgresql"` in `prisma/schema.prisma`, set `DATABASE_URL`, then run `npx prisma db push` (or adopt `prisma migrate`).
- Replace the three functions in `src/lib/storage.ts` (`storeFile`, `readStoredFile`, `deleteStoredFile`) with S3 / Cloudflare R2 / Supabase Storage calls.
- The in-memory rate limiter (`src/lib/rate-limit.ts`) is per instance; back it with Redis/Upstash for strict limits.

Country analytics appear automatically on platforms that send `x-vercel-ip-country` or `cf-ipcountry`.

HTTPS is required in production for the camera scanner and secure cookies.

---

## Features → where they live

| Area | Route | Key code |
|---|---|---|
| Homepage + quick generator | `/` | `src/components/home/quick-generator.tsx` |
| Generator (26 types) | `/generator` | `src/lib/qr-types.ts` (fields, zod validation, payload builders), `src/components/qr/workbench.tsx` |
| Customization studio | `/studio` | `src/components/qr/design-panel.tsx`, `src/lib/qr-render.ts` |
| UPI payment QR + standee | `/upi` | `src/lib/upi.ts`, `src/app/(app)/upi/upi-tool.tsx`, `src/lib/poster.ts` |
| Bulk CSV/Excel | `/bulk` | `src/app/(app)/bulk/bulk-tool.tsx` |
| Scanner | `/scanner` | `src/app/(app)/scanner/scanner.tsx`, `src/lib/content-safety.ts` |
| Dynamic QR management | `/dynamic` | redirect handler `src/app/r/[code]/route.ts` |
| Hosted landing pages | `/p/[code]` | `src/components/hosted-page.tsx` |
| Analytics | `/analytics`, `/analytics/[id]` | `src/lib/analytics.ts`, `src/lib/scans.ts` |
| Dashboard, history, settings | `/dashboard/*` | |
| Admin | `/admin` | `src/app/api/admin/*` |
| Pricing, Help, Privacy, Terms, Report | `/pricing` … `/report` | |

### QR rendering

`src/lib/qr-render.ts` is a pure SVG renderer on top of the `qrcode` encoder, so it runs identically in the browser and on Node. It supports square, rounded, dots, diamond, fluid and bar modules; square, rounded, circle and leaf eyes; linear and radial gradients; logo knock-out with automatic ECC-H; frames with captions; text above and below; background patterns; and a configurable quiet zone. Function patterns (timing and alignment) always stay solid so decorative styles keep scanning.

In the browser, every design change is rasterised and decoded with **jsQR**. The preview shows "Scan test passed" only when the decoded text matches the payload exactly. Exports: PNG, JPG and SVG up to 4096 px, PDF at 300 DPI (A4/A5/A6/Letter, single or sticker sheet), ZIP for bulk, and A4/A5 posters and standees.

### Barcodes, scanner & inventory

| Area | Route | Key code |
|---|---|---|
| Unified generator (QR \| Barcode tabs) | `/generator`, `/barcodes` | `src/components/generator-tabs.tsx`, `src/components/barcode/*` |
| Barcode formats, validation, check digits, labels | — | `src/lib/barcodes.ts` |
| Universal scanner | `/scanner` | `src/app/(app)/scanner/scanner.tsx`, `src/lib/zxing-client.ts`, `src/lib/scan-classify.ts`, `src/lib/scan-merge.ts` |
| Scan history (this device) | `/scan-history` | `src/lib/scan-history.ts` |
| Products (list, editor, import/export, bulk labels) | `/products`, `/products/new`, `/products/[id]` | `src/lib/products.ts`, `src/app/api/products/*` |
| Inventory dashboard | `/inventory` | `src/app/api/inventory/route.ts` |
| Bulk barcodes & labels | `/bulk?mode=barcode` | `src/app/(app)/bulk/barcode-bulk.tsx` |

**Libraries:**
- [`bwip-js`](https://github.com/metafloor/bwip-js) 4.x, the JavaScript port of BWIPP, generates every barcode as SVG/PNG in the browser and in Node.
- [`zxing-wasm`](https://github.com/Sec-ant/zxing-wasm) 3.x, ZXing-C++ compiled to WebAssembly, decodes codes in the browser. Its `.wasm` file is served from `/zxing/` (copied by `scripts/copy-wasm.mjs`), never from a CDN.
- `read-excel-file` / `write-excel-file` / `papaparse` handle CSV/XLSX.

#### Supported formats (each verified by the test suites)

| Format | Generate | Scan in app | Notes |
|---|:-:|:-:|---|
| QR Code (all 26 content types, UPI) | ✅ | ✅ | Existing QR generator + studio |
| Micro QR | ✅ | ✅ | Up to ~35 digits / 21 characters |
| GS1 QR Code | ✅ | ✅ | GS1 element strings |
| EAN-13 / EAN-8 | ✅ | ✅ | Check digit validated or calculated |
| UPC-A / UPC-E | ✅ | ✅ | UPC-E check via UPC-A expansion; scans normalise to the same GTIN |
| ISBN (EAN-13, ISBN-10 converted) | ✅ | ✅ | |
| ISSN (EAN-13 with 977 prefix) | ✅ | ✅ | |
| Code 128 | ✅ | ✅ | Full printable ASCII |
| GS1-128 | ✅ | ✅ | AI syntax, GTIN/SSCC check digits, dates, requisite-AI rule |
| Code 39 / Code 93 | ✅ | ✅ | Uppercase set; Code 93 includes its mandatory check characters |
| Codabar | ✅ | ✅ | A–D start/stop added if missing |
| ITF (Interleaved 2 of 5) / ITF-14 | ✅ | ✅ | ITF needs an even number of digits |
| Data Matrix / GS1 DataMatrix | ✅ | ✅ | |
| PDF417 | ✅ | ✅ | |
| Aztec | ✅ | ✅ | |
| Standard 2 of 5 | ✅ | ❌ | **Generate only.** zxing has no reader for it; use a hardware scanner |
| MSI / Plessey | ✅ | ❌ | **Generate only**, same reason |

The scanning engine can also detect GS1 DataBar, MaxiCode and rMQR, but the test suites don't cover those formats, so they aren't advertised.

#### GTINs: internal vs official

EAN/UPC/ITF-14 numbers sold through retail must be **GTINs allocated to your company by GS1** (GS1 India for Indian companies). QRSathi never claims to issue them:
- **Internal** numbers it generates use the GS1 restricted-circulation prefix **2** (20–29), valid only inside your own shop or warehouse. The server rejects an "internal" EAN/UPC outside that range.
- **Existing** barcodes (already printed by a manufacturer) and **GS1-allocated** GTINs are stored with their source, so the UI shows which is which.

#### Inventory rules
- Scanning never changes stock. Only explicit **Stock in / Stock out / Adjust** actions do.
- Stock out can't go below zero, and movements are atomic.
- Every create, edit, archive, restore and movement is written to `InventoryTransaction` (the activity history).
- SKUs are unique per user. Barcodes are unique per user by canonical lookup key, so a UPC-A and its EAN-13 form count as the same code.
- Products are archived, not deleted. Permanent deletion is only possible after archiving.
- Product counts follow plan limits: Free 100, Pro 5,000, Business 50,000. Import row limits follow the plan's bulk limit.

#### Scanner behaviour & limitations
- Camera access needs **HTTPS** (or `localhost`) and permission. The UI explains insecure-context, denied-permission and no-camera cases.
- Front/rear switching and a camera picker are available. **Flashlight and zoom** appear only when the browser exposes them (mostly Chrome on Android); desktop webcams usually don't.
- 1D barcodes must decode identically in **two consecutive frames** before they're shown, which guards against single-frame misreads. 2D codes are accepted immediately because they carry error correction.
- Uploaded images are decoded in a full pass plus overlapping strips. Strip results only fill gaps; they never replace a full-pass read. This catches codes such as a PDF417 that ZXing's multi-symbol search misses when several codes share an image.
- Decoding is fully on-device. Scan history lives in the browser's localStorage (max 500 entries), so camera scanning never writes to the database. A product lookup is a read-only GET.
- Very small, blurred, curved or glossy codes may not decode. Damaged 1D barcodes have no error correction.

#### Database changes (additive)
`prisma/schema.prisma` gains three models; no existing tables or columns were removed or changed:
- `Product`: name, SKU (`@@unique([userId, sku])`), product ID, brand, category, variant, description, manufacturer, image URL, price in minor units + currency, stock, low-stock level, batch, expiry, status (`active`/`archived`).
- `Barcode`: format, exact value, canonical `lookupKey`, source (`internal`/`assigned`/`existing`), primary flag. Constraints `@@unique([userId, format, value])` and `@@index([userId, lookupKey])`.
- `InventoryTransaction`: type, signed quantity, balance after, note, reference.
- `User` gets the matching relations. Applied with `npx prisma db push`, which is additive for these changes.

### Static vs dynamic

- **Static:** content is encoded directly. No account needed. Works offline, can't change.
- **Dynamic:** encodes `{APP_URL}/r/{code}` → 302 to the current destination (with optional UTM tags). Can be edited, paused, given an expiry (Pro+) or a custom alias (Pro+). **It depends on this server and domain staying online.**
- **Hosted pages** (multi-link, menu, business profile, coupon, product, app, feedback, custom landing): served at `{APP_URL}/p/{code}`, editable any time.

---

## Security & privacy notes

- Passwords are bcrypt-hashed (cost 12). Sessions are HS256 JWTs in an HttpOnly, SameSite=Lax cookie with a server-side `sessionVersion` for revocation (password reset, "sign out other devices", suspension).
- CSRF: `src/middleware.ts` rejects state-changing `/api` requests whose `Origin` doesn't match the host (webhooks are exempt and signature-verified instead).
- Login timing is equalised for unknown emails. Reset tokens are random, stored only as SHA-256 hashes and expire in 1 hour. There is no account enumeration on forgot-password. Auth, uploads and reports are rate-limited.
- Every request body is validated with zod on the server. Saved designs are whitelisted (`mergeDesign`) before being turned into SVG, so stored data can't inject markup. Hosted pages render user text as text and allow only `http(s)` links.
- Uploads have an extension whitelist plus magic-byte sniffing (no SVG/HTML), random filenames, live outside `public/`, and are served with `Content-Security-Policy: sandbox` and `nosniff`.
- Admin APIs check `role === "admin"` on every call. `/admin` returns 404 to non-admins.
- Scan analytics never store IP addresses: a salted, daily-rotating hash estimates unique visitors. Do-Not-Track and GPC are honoured (count only), bots and link-preview fetchers aren't counted, and owners can turn detailed tracking off per code.
- **Payments:** UPI QR codes only *request* a payment. Nothing in the app treats a scan as a payment. The only "paid" state is a signature-verified Razorpay webhook for subscriptions. The app never asks for or stores UPI PINs, OTPs or bank passwords.

The Privacy Policy and Terms pages are templates. Have them reviewed for your jurisdiction (e.g. India's DPDP Act 2023) before launch.

---

## Limitations / next steps

- jsQR is stricter than phone scanners. If the in-app scan test fails on an extreme design, simplify it, and always test-scan printed output with real phones.
- `xls` (legacy Excel) isn't supported in bulk upload. Save as `.xlsx` or CSV.
- Email verification on sign-up isn't enforced (Google sign-in requires a verified email).
- For multi-instance deployments, move rate limiting to Redis and storage to object storage (see Deploying).
- Standard 2 of 5 and MSI/Plessey can be generated but not scanned in the app.
- Scan history is per device (localStorage), not synced to the account.
- Bulk product import is processed row by row on the server. Very large files (thousands of rows) take a few seconds and are capped by the plan's bulk limit.
- Rate limiting identifies clients by `X-Forwarded-For` / `CF-Connecting-IP`. Deploy behind a proxy that sets these headers, or clients could spoof them.
