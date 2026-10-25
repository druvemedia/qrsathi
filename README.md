# QRSathi: QR code & barcode platform for India

QRSathi is a full-stack web app:
- **31 QR content types** (including TikTok, X, Telegram, Snapchat and Spotify profiles), plus a dedicated **UPI payment QR** generator with printable standees.
- A design studio, **dynamic (editable) QR codes** with privacy-respecting scan analytics, and hosted landing pages.
- A **barcode generator** (21 symbologies) and a **universal camera/image scanner** (QR, 1D and 2D codes).
- **Products & inventory**: stock movements, barcode lookup, CSV/XLSX import and label printing.
- Bulk generation, user accounts and plans.
- A separate **admin console**: role-based access, two-factor authentication, an audit log and moderation tools.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma**. It uses **SQLite** in development and **MySQL 8** in production.

> **Licence:** not chosen yet. See [docs/LICENSING.md](docs/LICENSING.md). Until a `LICENSE` file is added, all rights are reserved.

---

## Quick start (development, SQLite)

Requirements: **Node.js 22** (`.nvmrc`) and npm 10.

```bash
git clone https://github.com/druvemedia/qrsathi.git && cd qrsathi
cp .env.example .env     # set AUTH_SECRET (the file explains how to generate one)
npm install              # generates the Prisma client and copies the scanner's WebAssembly to public/zxing/
npx prisma db push       # creates prisma/dev.db (keeps data on later runs)
npm run dev              # http://localhost:3000
```

On Windows, stop the dev server before `npm install` or `prisma generate`: Windows locks Prisma's engine file while the server runs.

### First administrator

Administrators are never created from the website. On the machine that has database access, run:

```bash
npm run admin -- create --email you@example.com --super
```

You're prompted for a password. Then sign in at **`/admin/login`** and set up two-factor authentication. See [docs/ADMIN.md](docs/ADMIN.md) for roles, MFA and account recovery.

### Demo data (development only)

Set `DEMO_MODE="true"` in `.env`, then run `npm run seed:demo`.
- This creates the ordinary user `demo@demo.local` / `demo12345` with sample QR codes and about 1,000 sample scans. Every record is labelled **Demo**.
- The seeder never creates administrators.
- It refuses to run when `NODE_ENV=production`, and the production server refuses to start with `DEMO_MODE=true`.

---

## Sign-in URLs

| Who | Sign in | Password reset |
|---|---|---|
| Customers | `/login`, `/signup` | `/forgot-password` → `/reset-password` |
| Administrators | `/admin/login` (password, then 2FA code) | `/admin/forgot-password` |

Both use one accounts table but separate session cookies and separate authorisation. A customer session never opens the admin console. Public sign-up always creates an ordinary user.

## Admin console (`/admin`)

| Page | What it does |
|---|---|
| **Overview** | Real KPIs: users, QR codes, scans, products, failed sign-ins, verified revenue. Also shows alerts. |
| **Users** | Search, filters, sorting and pagination. Suspend/reactivate, sign out everywhere, send a reset link, change plan. Role changes and deletion are super-admin only. Bulk actions ask for confirmation. |
| **QR codes / Abuse reports** | Moderation of public-facing dynamic redirects and hosted pages. |
| **Products & inventory** | Platform-wide aggregates only; customers' catalogues stay private. |
| **Analytics, Subscriptions, Payments** | Aggregate activity; Razorpay subscriptions (cancel at period end or now); payment history with refunds. |
| **Plans & pricing** | Create, edit, duplicate, publish, archive and reorder plans. Prices in minor units; entitlements enforced by the server; live preview; Razorpay plan sync ([docs/BILLING.md](docs/BILLING.md)). |
| **Website branding / Appearance** | Titles, SEO and social text, contact details, footer social profile links (each validated against that network's own domain; empty ones are hidden), logos (light and dark), favicon, social image, colours, default theme. Draft → preview → publish. |
| **Payment gateway / Email** | Razorpay test and live credentials (encrypted, never shown again), read-only connection test, checkout switch. SMTP status and a test e-mail. |
| **Security & audit** | Sign-in failures, administrator list with 2FA status, full audit log. |
| **Site settings / System** | Branding and sign-up policy. Health, configuration flags (never secret values) and the application error log. |

---

## Databases

- **Development:** SQLite (`DATABASE_URL="file:./dev.db"`), schema `prisma/schema.prisma`.
- **Production:** MySQL 8 (`DATABASE_URL="mysql://…"`), generated schema `prisma/mysql/schema.prisma` with versioned migrations in `prisma/mysql/migrations/`.

```bash
npm run db:mysql:deploy          # apply MySQL migrations (non-destructive)
npm run db:migrate-data -- --dry-run                      # check an existing SQLite database
MYSQL_URL="mysql://…" npm run db:migrate-data             # copy SQLite → empty MySQL, verified row by row
```

Full guide, including rollback and SQLite/MySQL differences: [docs/DATABASE.md](docs/DATABASE.md).

## Configuration

Every variable is documented in [`.env.example`](.env.example), with placeholders only.

The server validates its configuration at startup. In production it **refuses to start** on unsafe settings:
- missing or placeholder `AUTH_SECRET`;
- a non-https `NEXT_PUBLIC_APP_URL`;
- `DEMO_MODE` on;
- a secret placed in a `NEXT_PUBLIC_*` variable.

Optional integrations: Google sign-in, SMTP (password reset, and the public contact form — shown only when SMTP and a support e-mail are both set) and Razorpay (subscriptions). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#7-integrations).

## Tests

```bash
npm run typecheck
npm run lint
npm test                 # security unit tests + QR rendering/decoding + barcode suites (no server needed)

# Integration tests run against a production build with a throw-away database:
npm run build && npm start                              # or a separate build: NEXT_DIST_DIR=.next-test …
BASE_URL=http://localhost:3000 npm run test:api
BASE_URL=http://localhost:3000 DATABASE_URL=file:/abs/path/to/that.db npm run test:admin
BASE_URL=http://localhost:3000 DATABASE_URL=file:/abs/path/to/that.db npm run test:browser   # needs Edge or Chrome

BASE_URL=http://localhost:3000 DATABASE_URL=file:/abs/path/to/that.db npm run test:billing   # starts a Razorpay mock on :3999
MYSQL_TEST_URL="mysql://root:pw@127.0.0.1:3306/" npm run test:mysql   # real MySQL; creates and drops its own databases
```

Never point the integration tests at a production database: they create and delete accounts.

| Suite | Covers |
|---|---|
| `test` | Open-redirect guard, log redaction, JSON-LD escaping, startup validation, TOTP (RFC 6238 vectors), MFA secret encryption, recovery codes, rate limiting, IP spoofing, CSRF origin rules, RBAC rules, MySQL schema generator. Every QR style and content type is rendered and decoded. Every barcode format is rendered and decoded with the app's own scanner. |
| `test:api` | Auth and CSRF, products, barcode lookup, stock, isolation between users, import, existing QR/UPI/dynamic features. |
| `test:admin` | Sign-up can't create admins, admin APIs deny by default, separate admin login, MFA enrolment, replay and recovery codes, logout invalidation, RBAC, suspension, last-super-admin rules, audit log, reset tokens, session fixation, uploads, rate limits, webhook signature and idempotency, no secrets in client bundles. |
| `test:browser` | Camera and image scanning. Every public, workspace and admin page at 375/768/1280 px (no horizontal overflow, no CSP violations, no console errors, accessible names). Admin sign-in through the real form. Run with `DARK=1` for dark mode. |
| `test:billing` | Against a deterministic Razorpay **mock** (needs `RAZORPAY_API_BASE` + `SETTINGS_ENCRYPTION_KEY` on the server):
- credential masking, encryption and re-auth;
- signature and webhook verification, duplicates, mismatches;
- activation only after confirmation;
- failure, renewal, halt, cancel and refund;
- pricing CRUD and history integrity; server-priced checkout;
- quota races, branding uploads and XSS; no secret leaks. |
| `test:mysql` | Migrations on a fresh MySQL server, an edge-case SQLite → MySQL copy, case-sensitive identifiers, constraints and failure safety. |

CI (`.github/workflows/ci.yml`) runs:
- typecheck, lint, unit tests and the licence and audit gates;
- build, then the API, admin and browser tests;
- the MySQL test against a MySQL 8.4 service.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for:
- server setup, reverse proxy and HTTPS;
- cookies, the health check and logging;
- upgrades and rollback;
- a production checklist.

Backups: [docs/BACKUP-RECOVERY.md](docs/BACKUP-RECOVERY.md).

---

## Features → where they live

| Area | Route | Key code |
|---|---|---|
| Homepage + quick generator | `/` | `src/components/home/quick-generator.tsx` |
| Generator (31 types) | `/generator` | `src/lib/qr-types.ts`, `src/components/qr/workbench.tsx` |
| Design studio | `/studio` | `src/components/qr/design-panel.tsx`, `src/lib/qr-render.ts` |
| UPI payment QR + standee | `/upi` | `src/lib/upi.ts`, `src/app/(app)/upi/upi-tool.tsx` |
| Barcodes | `/barcodes` | `src/lib/barcodes.ts`, `src/components/barcode/*` |
| Universal scanner | `/scanner`, `/scan-history` | `src/app/(app)/scanner/scanner.tsx`, `src/lib/zxing-client.ts` |
| Products & inventory | `/products`, `/inventory` | `src/lib/products.ts`, `src/app/api/products/*` |
| Bulk | `/bulk` | `src/app/(app)/bulk/*` |
| Dynamic QR & hosted pages | `/dynamic`, `/r/[code]`, `/p/[code]` | `src/app/r/[code]/route.ts`, `src/components/hosted-page.tsx` |
| Analytics | `/analytics` | `src/lib/analytics.ts`, `src/lib/scans.ts` |
| Admin console | `/admin/*` | `src/app/admin/*`, `src/components/admin/*`, `src/app/api/admin/*` |
| Auth & sessions | `/login`, `/admin/login` | `src/lib/session.ts`, `src/lib/auth-flow.ts`, `src/lib/mfa.ts` |

Barcode formats, scanner behaviour and GTIN rules are documented in [docs/BARCODES.md](docs/BARCODES.md).

## Security & privacy

- **Passwords and sessions.** Passwords use bcrypt (cost 12). Sessions are stored on the server behind HttpOnly cookies, so logout, password change, password reset and suspension take effect immediately.
- **Admin protection.** The admin console has its own short-lived cookie, TOTP 2FA (required for super administrators) and an audit log.
- **Request handling.** Every request body is validated with zod. Every resource is checked for ownership. Authentication, uploads, reports, QR creation and scan recording are rate-limited.
- **Browser hardening.** CSRF origin check, Content-Security-Policy, HSTS over HTTPS, and safe redirects.
- **Privacy.** Scan analytics never store IP addresses. Do-Not-Track and GPC are honoured.
- **Payments.** UPI QR codes only *request* payment; a plan is upgraded only by a signature-verified Razorpay webhook.

Found a vulnerability? See [SECURITY.md](SECURITY.md). The latest audit, including known remaining risks, is in [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md). No system is completely secure.

The Privacy Policy and Terms pages are templates. Have them reviewed for your jurisdiction (e.g. India's DPDP Act 2023).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).
