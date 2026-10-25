# QRSathi — Installation and User Guide

Commands below were taken from `package.json`, `README.md` and `docs/*.md` and were exercised during the audit where marked ✔. Never put real secrets in documents or commit `.env`.

## Part A — Installation

### A.1 Requirements

| Item | Requirement |
|---|---|
| Node.js | ≥ 22.5 (`.nvmrc` = 22) ✔ 22.22.3 |
| npm | ≥ 10 ✔ 10.9.8 |
| Database | SQLite (built in) for development ✔; MySQL 8 for production ✔ (migrations tested on 8.4) |
| Browser | Current Chrome/Edge ✔ (Firefox/Safari not tested) |
| Optional | SMTP server (password reset), Google OAuth client, Razorpay account |

### A.2 Development set-up

```bash
git clone https://github.com/druvemedia/qrsathi.git
cd qrsathi
npm install                 # postinstall: prisma generate + copy scanner WASM
cp .env.example .env
```

Edit `.env` (names only shown; choose your own values):

| Variable | Development value |
|---|---|
| `DATABASE_URL` | `file:./dev.db` |
| `AUTH_SECRET` | a random string of at least 32 characters |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |

```bash
npm run db:push                                          # create SQLite DB
npm run admin -- create --email you@example.com --super  # type the password when asked (≥ 12 chars)
npm run dev                                              # http://localhost:3000
```

Optional demo data (development only): set `DEMO_MODE=true` and run `npm run seed:demo`.

### A.3 Quality checks ✔

```bash
npm run typecheck
npm run lint
npm test
```

### A.4 Production (recommended procedure — not performed in the audit)

1. Create a MySQL 8 database and a least-privilege user.
2. Set production variables: `DATABASE_URL` (mysql://…), `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `SETTINGS_ENCRYPTION_KEY` (all random, ≥ 32 chars, different), `NEXT_PUBLIC_APP_URL` (https), `TRUST_PROXY`, `RATE_LIMIT_STORE=database`, `SMTP_*`, `MAIL_FROM`; optionally Google and Razorpay variables.
3. `npm ci && npm run db:mysql:deploy && npm run build` ✔ (build and MySQL migrations exercised in the audit)
4. Run `npm start` under a process manager behind an HTTPS reverse proxy.
5. Monitor `GET /api/health`; back up the database **and** `UPLOAD_DIR` (`docs/BACKUP-RECOVERY.md`).
6. Create the super administrator, sign in at `/admin/login`, enrol MFA.
7. For payments: Admin → Payment gateway → enter keys (requires re-authentication) → Test connection → enable checkout; configure the Razorpay webhook to `https://<your-domain>/api/billing/webhook`.

**Known issue:** uploads larger than 10 MB fail (defect D-01) until the middleware body limit is addressed.

### A.5 Migrating development data to MySQL

```bash
npm run db:migrate-data      # see docs/DATABASE.md: dry run first, empty target required
```

## Part B — User guide

### B.1 Accounts
- **Sign up** at `/signup` (name, e-mail, password with a letter and a digit, accept terms) or **Continue with Google** if enabled.
- **Forgot password:** `/forgot-password` sends a one-hour link (requires SMTP).
- **Settings** (`/dashboard/settings`): change name or password, sign out other devices, choose theme, view billing, delete account (type your e-mail).

### B.2 Create a QR code (`/generator`)
1. Choose a type (Website, Wi-Fi, vCard, WhatsApp, UPI, Menu, Links, Event, …).
2. Fill the form; errors appear next to fields.
3. **Design** tab: colours or gradient, module and eye shapes, logo (error correction rises to H automatically), frame and caption.
4. Check the preview and the "Scan test passed" message.
5. **Download** PNG, JPG, SVG or PDF, or **Save** to your library (sign-in required).

Turn on **Dynamic QR** to print a short link whose destination you can change later (`/dynamic`): edit, pause, set expiry (plan-dependent), add UTM tags, and view analytics.

### B.3 UPI payment QR (`/upi`)
Enter a UPI ID (or account number + IFSC), payee name, optional amount and note; print a standee. Amounts above ₹1,00,000 show a warning; above ₹5,00,000 are rejected.

### B.4 Barcodes and labels (`/barcodes`)
Pick a format (EAN-13, UPC-A, Code 128, GS1-128, Data Matrix, …), enter a value (check digits are validated or computed), choose a label size and layout, and export. Use internal numbers starting with 2 unless GS1 assigned you real GTINs.

### B.5 Scanner (`/scanner`)
Allow camera access or upload an image (several codes per image are detected). Results show the content type and safety notes — for example, a warning that you never need to scan a UPI QR to *receive* money. Past scans are in **Scan History** (stored only on this device).

### B.6 Products and inventory (`/products`, `/inventory`)
- **Add product:** name, SKU (unique), price, stock, low-stock level, category, batch/expiry and up to 10 barcodes (use "Generate" for an internal EAN-13).
- **Stock:** on a product page choose *Stock in*, *Stock out* (cannot exceed stock) or *Adjust* (stock-take). Every change is listed in the activity history with the resulting balance.
- **Low stock** items are flagged in the list and on the dashboard.
- **Archive** a product before deleting it permanently. Archived products cannot change stock.
- **Import** CSV/XLSX with snake_case headers (`name`, `sku`, `price`, `stock`, `barcode`, `barcode_format`, …); choose *skip* or *update* for existing SKUs and review the per-row report.
- **Scan to find:** scanning a saved barcode in the scanner shows the product (read-only).

### B.7 Bulk generator (`/bulk`)
Paste or upload a table to generate many QR codes or barcodes at once and download them as a ZIP or PDF. Row limits depend on the plan.

### B.8 Analytics (`/analytics`)
Per-code scans by day, device, browser, OS and country, within your plan's history window; CSV export where the plan allows. Visitors who send Do-Not-Track are counted without details.

### B.9 Plans and billing (`/pricing`, Settings → Billing)
Choose a plan and interval; pay in Razorpay Checkout; the plan activates after the payment is verified. Cancel at period end from Settings → Billing.

### B.10 Administrators (`/admin`)
- Sign in at `/admin/login` (separate from the workspace). Super administrators must enrol an authenticator app at `/admin/mfa`; keep the recovery codes safe.
- **Users:** search, suspend/reactivate, sign out sessions, send reset links, change plans; super administrators can change roles and delete accounts.
- **QR codes / Abuse reports:** pause or disable codes; resolve reports.
- **Configuration:** general settings, branding (draft → publish), appearance, e-mail test, plans & pricing (super admin), payment gateway (super admin, re-authentication).
- **Security:** audit log, administrators, security events. **System:** configuration and health.
- CLI recovery: `npm run admin -- list | promote | demote | reset-mfa | create`.
