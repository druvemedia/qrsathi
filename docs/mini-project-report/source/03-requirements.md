# Chapter 3: System Requirements

## 3.1 Introduction

This chapter specifies the requirements of QRSathi. Requirements that are *verified* (observed in the repository or in the audit environment) are distinguished from *recommended* values (judgements for a comfortable deployment that were not measured). Functional requirements are given identifiers (FR-xx) that are traced to source files and test evidence in Section 3.16, Appendix H and the accompanying spreadsheet `QRSathi_Requirement_Traceability_Matrix.xlsx`.

## 3.2 Hardware Requirements

Table 3.1: Hardware requirements

| Component | Verified in audit environment | Recommended minimum (not measured) |
|---|---|---|
| Development machine | Windows 11 Pro (10.0.26200) workstation on which the build and all tests ran | 4-core CPU, 8 GB RAM, 5 GB free disk (dependencies ~1 GB, builds, browser) |
| Production server | Not deployed during the audit | 2 vCPU, 2–4 GB RAM for one Node.js instance; SSD storage sized for uploads and database |
| Database server | MySQL 8.4 in a local Docker container (for the migration test) | Managed or self-hosted MySQL 8 with automated backups |
| Client device | Desktop Edge/Chrome (automated browser tests) | Any device running a current browser; a camera for live scanning |

## 3.3 Software Requirements

Official documentation for the main technologies is listed in the references: Next.js [1], [2], React [3], TypeScript [4], Prisma [5], Tailwind CSS [6], MySQL [7], SQLite [28], zod [24] and node-qrcode [27].

Table 3.2: Software requirements (versions verified from `package.json`, `npm ls` and the environment)

| Software | Version verified | Purpose |
|---|---|---|
| Node.js | 22.22.3 (engine requirement `>=22.5.0`; `.nvmrc` = 22) | JavaScript runtime for build, server and scripts |
| npm | 10.9.8 (requirement `>=10`) | Package manager |
| Next.js | 15.5.28 | Full-stack React framework (App Router, route handlers, middleware) |
| React / React DOM | 19.3.1 | User-interface library |
| TypeScript | 5.9.3 | Static typing |
| Prisma CLI / @prisma/client | 6.19.3 | ORM, schema, migrations |
| SQLite | via Prisma's bundled engine | Development database (`prisma/dev.db`) |
| MySQL | 8.x (CI uses 8.4; audit test used `mysql:8.4` image) | Production database target |
| Tailwind CSS | 3.4.19 (+ PostCSS 8.5.31, Autoprefixer 10.6.1) | Utility-first styling |
| ESLint | 9.39.5 with `eslint-config-next` 15.5.28 | Linting |
| tsx | 4.23.15 | Running TypeScript test and admin scripts |
| Browser | Microsoft Edge / Google Chrome (Chromium) | Runtime for the UI; headless browser tests |
| Git / GitHub Actions | — | Version control and CI (`.github/workflows/ci.yml`) |

## 3.4 Development Environment

Development uses `npm run dev` (Next.js development server on port 3000) with a SQLite database at `prisma/dev.db`. Before starting, a `predev` script copies the zxing WebAssembly decoder into `public/zxing/`. Visual Studio Code was the editor in the audited environment. Code quality tools are `npm run typecheck` (TypeScript `--noEmit`), `npm run lint` (ESLint 9 flat config) and the test scripts listed in Chapter 5.

## 3.5 Runtime Environment

The production runtime is `next build` followed by `next start` on Node.js 22. At start-up, `src/instrumentation.ts` validates the configuration with `checkEnv()` and **refuses to start** a production server with unsafe settings (for example a short `AUTH_SECRET`, a non-HTTPS public URL, `DEMO_MODE=true`, or a secret exposed through a `NEXT_PUBLIC_` variable). The server is stateless apart from the database, uploaded files on disk and (by default) in-memory rate-limit counters.

## 3.6 Frontend Requirements

- React 19 components rendered by the Next.js App Router; client components for interactive tools (generator, scanner, editors).
- Tailwind CSS with CSS variables for brand colours, light/dark themes (`src/components/providers.tsx`).
- Icons from `lucide-react`; charts with `recharts`; toast notifications with `sonner`.
- Client-side libraries: `qrcode` (QR matrix), `bwip-js` (barcodes), `zxing-wasm` (decoding), `jspdf` and `jszip` (PDF/ZIP export), `jsqr` (verifying exported QR images), `papaparse`, `read-excel-file` and `write-excel-file` (CSV/XLSX).
- Browser APIs: `getUserMedia` for the camera (Permissions-Policy allows the camera only for the same origin), Canvas, Blob downloads, `localStorage` for theme and scan history.

## 3.7 Backend Requirements

- Next.js route handlers (`src/app/**/route.ts`) and server components; middleware for CSRF origin checks.
- Validation with `zod` 4.6.7 shared between client and server.
- Authentication: `bcryptjs` (cost 12) for passwords, `jose` for HS256-signed session tokens, Node `crypto` for TOTP, AES-256-GCM and HMAC.
- `nodemailer` for SMTP; `fetch` for Razorpay and Google APIs.
- Local file storage under `UPLOAD_DIR`.

## 3.8 Database Requirements

- A relational database supported by Prisma: SQLite (development) or MySQL 8 (production). The schema has 22 models (Section 4.9).
- MySQL must use a case-sensitive collation for identifier columns where required; the generated schema and migrations handle this (`scripts/db/mysql-schema.mjs`, verified by `npm run test:mysql`).
- Transactions are required for quota checks, stock movements and billing updates.
- Backups: documented in `docs/BACKUP-RECOVERY.md` (not automated by the application).

## 3.9 Network and Connectivity Requirements

- HTTPS in production (enforced by start-up validation unless the host is local). HSTS is sent automatically when the public URL uses HTTPS.
- Outbound HTTPS to `api.razorpay.com`, `accounts.google.com`, `oauth2.googleapis.com`, `openidconnect.googleapis.com` and the SMTP host — only if those optional integrations are enabled.
- Inbound HTTPS for Razorpay webhooks at `/api/billing/webhook`.
- Behind a reverse proxy, `TRUST_PROXY` must be set so that client IP addresses used for rate limiting are taken from trusted headers.

## 3.10 Browser Compatibility

The automated browser suite runs on Chromium (Edge or Chrome) using the DevTools protocol. Firefox and Safari were **not tested** in this audit. Camera scanning requires a browser that supports `getUserMedia` and WebAssembly; the scanner also accepts uploaded images when no camera is available.

## 3.11 Functional Requirements

Each requirement lists the actor, preconditions, normal flow, alternative flows and postconditions. "Implementation" names the main source location.

### FR-01 User registration
- **Description:** A visitor creates an account with name, e-mail and password.
- **Actor:** Visitor.
- **Preconditions:** Sign-ups are enabled in site settings.
- **Normal flow:** (1) Visitor submits the sign-up form and accepts the terms. (2) The server rate-limits by IP, validates input, checks that the e-mail is not registered, hashes the password and creates a `user`-role account. (3) A session cookie is set and the user is redirected to the dashboard.
- **Alternative flows:** invalid input → 400 with the first validation message; e-mail exists → 409; sign-ups closed → 403; too many attempts → 429.
- **Postconditions:** `User` and `Session` rows exist; `auth.signup` is audited.
- **Implementation:** `src/app/api/auth/signup/route.ts`.

### FR-02 User sign-in and sign-out
- **Description:** A user authenticates with e-mail and password, or Google; and can sign out.
- **Actor:** User.
- **Preconditions:** Account exists and is active.
- **Normal flow:** credentials verified (`verifyCredentials`), new `Session` row and `qs_session` cookie created, `lastLoginAt` updated.
- **Alternative flows:** wrong password, unknown e-mail or password-less account → identical 401 message; suspended → 403; rate limit → 429. Google: state mismatch, unverified e-mail or closed sign-ups → redirect to `/login?error=…`.
- **Postconditions:** session valid for 30 days or until sign-out, password change, suspension or revocation.
- **Implementation:** `src/app/api/auth/login`, `logout`, `google`, `google/callback`; `src/lib/auth-flow.ts`, `src/lib/session.ts`.

### FR-03 Password reset
- **Description:** A user requests a reset link and sets a new password.
- **Actor:** User.
- **Normal flow:** e-mail submitted → same response whether or not the account exists → for active accounts a random token is generated, only its SHA-256 hash stored, valid for one hour → user opens link and submits a new password → token claimed atomically, password updated, all sessions revoked, new session created.
- **Alternative flows:** invalid/used/expired token → 400; more than 3 mails per account per hour are silently skipped.
- **Implementation:** `src/app/api/auth/forgot`, `reset`; `src/lib/password-reset.ts`.

### FR-04 Account management
- **Description:** Change name or password, sign out other devices, delete account.
- **Actor:** User.
- **Normal flow:** password change requires the current password, increments `sessionVersion`, revokes other sessions and keeps the current one. Deletion requires typing the account e-mail.
- **Alternative flows:** wrong current password → 400; last super administrator cannot delete their own account → 400.
- **Implementation:** `src/app/api/account/route.ts`, `account/sessions/route.ts`.

### FR-05 Static QR code generation
- **Description:** Generate a QR code for one of 27 content types and export it.
- **Actor:** Visitor or user.
- **Normal flow:** select type → fill the type-specific form (validated by the type's zod schema) → customise design → preview is rendered in the browser → export PNG, JPG, SVG or PDF (ZIP for batches).
- **Alternative flows:** invalid field → inline error; low contrast or logo too large → design warning.
- **Postconditions:** nothing stored unless the user saves (FR-06).
- **Implementation:** `src/lib/qr-types.ts`, `src/lib/qr-render.ts`, `src/lib/qr-export.ts`, `src/components/qr/*`.

### FR-06 Save and manage QR codes
- **Description:** Signed-in users save QR codes and list, search, filter, favourite, edit, pause/resume, duplicate and delete them.
- **Actor:** User.
- **Preconditions:** Signed in; within plan quota.
- **Normal flow:** `POST /api/qrcodes` validates content again on the server, checks quotas in a transaction, stores the code.
- **Alternative flows:** quota exceeded → 403 naming the plan limit; QR disabled by an administrator cannot be re-activated by the owner → 403.
- **Implementation:** `src/lib/qr-service.ts`, `src/app/api/qrcodes/**`.

### FR-07 Dynamic QR codes and hosted pages
- **Description:** Create a QR code whose printed short link redirects to an editable destination, or shows a hosted landing page.
- **Actor:** User (creates), visitor (scans).
- **Normal flow:** short code (random 7 characters or a custom alias where the plan allows) is allocated; visitors are redirected by `/r/{code}` with UTM parameters, or served `/p/{code}`.
- **Alternative flows:** destination not http(s) → 400; alias reserved or taken → 400/409; paused, disabled, expired or owner suspended → explanatory 410 page; unknown code → 404 page.
- **Implementation:** `src/lib/qr-service.ts`, `src/app/r/[code]/route.ts`, `src/app/p/[code]/page.tsx`.

### FR-08 Scan analytics
- **Description:** Record scans of dynamic codes and display statistics.
- **Actor:** Visitor (generates), user (views).
- **Normal flow:** each non-bot scan, limited to 20 per client per code per 10 minutes, is stored with device, browser, OS and country and a salted daily visitor hash; DNT/GPC or tracking-off produce count-only rows. Users view charts limited to their plan's `analyticsDays`; CSV export requires the `analyticsExport` feature.
- **Implementation:** `src/lib/scans.ts`, `src/lib/analytics.ts`, `src/app/api/analytics/**`.

### FR-09 Barcode generation and labels
- **Description:** Generate barcodes in 23 formats and printable labels.
- **Actor:** Visitor or user.
- **Normal flow:** select format → enter value → validation (length, characters, check digit; computed when omitted where applicable) → SVG rendered by bwip-js → optional label layout in one of six sizes → export.
- **Alternative flows:** invalid value → error explaining the rule.
- **Implementation:** `src/lib/barcodes.ts`, `src/components/barcode/*`, `src/lib/barcode-export.ts`.

### FR-10 Universal scanner
- **Description:** Decode QR codes and barcodes from the camera or an image.
- **Actor:** Visitor or user.
- **Normal flow:** zxing-wasm decodes frames or an uploaded image (multiple codes per image supported) → content classified (URL, UPI, Wi-Fi, contact, product barcode …) → safety notes shown → entry saved to the on-device history.
- **Alternative flows:** no code found → hints; signed-in users can look up a product by the scanned code (read-only).
- **Implementation:** `src/app/(app)/scanner/scanner.tsx`, `src/lib/zxing-client.ts`, `src/lib/scan-classify.ts`, `src/lib/content-safety.ts`, `src/lib/scan-history.ts`.

### FR-11 Product management
- **Description:** Create, view, edit, archive, restore and delete products, each with up to 10 barcodes.
- **Actor:** User.
- **Normal flow:** validate fields → validate and normalise barcodes → check SKU and barcode uniqueness → check product and barcode quotas → create product, barcodes and an initial `created` ledger entry.
- **Alternative flows:** duplicates → 409; invalid barcode or internal GTIN outside 20–29 → 400; delete of an active product → 400 ("archive first").
- **Implementation:** `src/lib/products.ts`, `src/app/api/products/**`.

### FR-12 Stock movements and inventory
- **Description:** Record stock in, stock out and stock-take adjustments; show low stock and history.
- **Actor:** User.
- **Normal flow:** movement validated → applied atomically → ledger entry with signed quantity and balance → product flagged low when `stock <= lowStockAt`.
- **Alternative flows:** stock-out larger than stock → 400 with available quantity; quantity 0 for in/out → 400; archived product → 400.
- **Implementation:** `moveStock()` in `src/lib/products.ts`, `src/app/api/products/[id]/stock`, `src/app/api/inventory`.

### FR-13 Bulk generation and import
- **Description:** Generate many QR codes or barcodes from a table and import products from CSV/XLSX.
- **Actor:** User.
- **Normal flow:** file parsed in the browser → rows validated → codes generated or `POST /api/products/import` with mode `skip` or `update` → per-row report (created/updated/skipped/error).
- **Alternative flows:** more rows than the plan's `bulkRows` → 403; duplicate SKU in the file or unknown barcode format → row error.
- **Implementation:** `src/app/(app)/bulk/*`, `src/lib/table-file.ts`, `src/app/api/products/import/route.ts`.

### FR-14 File uploads for QR content
- **Description:** Upload files (PDF, images, Office documents, text) to be linked from "File" QR codes.
- **Actor:** User.
- **Normal flow:** size checked against the plan limit → extension allow-list → magic-byte check → stored under a random name → served at `/f/{name}` with restrictive headers.
- **Alternative flows:** unsupported type or content mismatch → 415; over limit → 413; storage quota exceeded → 403.
- **Known defect:** uploads above 10 MB fail with 400 even when the plan allows 25 or 50 MB (D-01, Chapter 5).
- **Implementation:** `src/app/api/uploads/route.ts`, `src/lib/storage.ts`, `src/app/f/[name]/route.ts`.

### FR-15 Plans and entitlements
- **Description:** Enforce plan limits and features on the server.
- **Actor:** System.
- **Normal flow:** `planForUser()` loads the plan (database-backed catalogue with defaults Free, Pro and Business) → quota checks run inside `withQuota`, which first increments the user's `quotaLock` to serialise concurrent requests.
- **Implementation:** `src/lib/entitlements.ts`, `src/lib/plan-store.ts`, `src/lib/plans.ts`.

### FR-16 Subscription billing
- **Description:** Users subscribe to a paid plan through Razorpay, see their billing status and cancel.
- **Actor:** User; Razorpay.
- **Preconditions:** checkout enabled by a super administrator with verified credentials; provider plan synchronised.
- **Normal flow:** see Figure 4.12 and Figure 4.24.
- **Alternative flows:** existing live subscription → 409; signature invalid → 400; amount mismatch → plan unchanged; webhook duplicate → no effect.
- **Implementation:** `src/lib/billing.ts`, `src/lib/razorpay.ts`, `src/app/api/billing/**`.

### FR-17 Administrator authentication and MFA
- **Description:** Administrators sign in through `/admin/login`, with TOTP MFA (mandatory for super administrators) and recovery codes.
- **Actor:** Admin, super admin.
- **Normal flow:** password step → if MFA enabled, a 5-minute ticket → TOTP or recovery code → `qs_admin` session (12 h, 2 h idle, SameSite=Strict).
- **Alternative flows:** non-admin → same generic 401; replayed TOTP → 401; super admin without MFA → forced enrolment.
- **Implementation:** `src/app/api/admin/auth/**`, `src/app/api/admin/mfa`, `src/lib/mfa.ts`, `src/lib/admin-auth.ts`.

### FR-18 User administration
- **Description:** Search users; suspend/reactivate; revoke sessions; send reset links; change plan; (super admin) change role and delete.
- **Actor:** Admin, super admin.
- **Alternative flows:** admin acting on an administrator, changing roles or deleting → 403; acting on oneself → 400; last super admin → 400.
- **Implementation:** `src/app/api/admin/users/**`, `src/lib/admin-users.ts`.

### FR-19 Content moderation
- **Description:** View and pause/disable/delete dynamic QR codes; triage abuse reports submitted by visitors.
- **Actor:** Admin; visitor (report).
- **Implementation:** `src/app/api/admin/qrcodes/**`, `src/app/api/admin/reports/**`, `src/app/api/reports/route.ts`.

### FR-20 Site configuration
- **Description:** Edit general settings (announcement, sign-ups), branding (names, colours, logos, favicon, social image; draft → publish), appearance, e-mail test, pricing plans and payment credentials.
- **Actor:** Admin (settings, branding); super admin (pricing, payments).
- **Implementation:** `src/app/api/admin/settings`, `branding`, `branding/assets`, `email`, `plans/**`, `payments/config`; `src/lib/branding.ts`, `src/lib/payment-config.ts`, `src/lib/secret-box.ts`.

### FR-21 Audit, logs and system status
- **Description:** Record security events and administrator actions; show logs, security events and configuration status.
- **Actor:** System; admin.
- **Implementation:** `src/lib/audit.ts`, `src/lib/log.ts`, `src/lib/system-status.ts`, `src/app/api/admin/security`, `logs`, `system`; `/api/health`.

### FR-22 UPI payment QR
- **Description:** Create UPI payment QR codes (`upi://pay`) for a VPA or bank account + IFSC, with optional amount and note, and printable standees.
- **Actor:** Visitor or user.
- **Alternative flows:** invalid VPA, IFSC or amount → validation error; amounts above ₹1,00,000 produce a warning and above ₹5,00,000 are rejected.
- **Implementation:** `src/lib/upi.ts`, `src/app/(app)/upi/*`, `src/lib/poster.ts`.

## 3.12 Non-Functional Requirements

Table 3.3: Non-functional requirements

| ID | Category | Requirement | Status / evidence |
|---|---|---|---|
| NFR-01 | Security | All private API routes require an authenticated session; admin routes require an admin-console session | Verified (test:api, test:admin) |
| NFR-02 | Security | State-changing API requests from other origins are rejected | Verified ("cross-site POST blocked (403)") |
| NFR-03 | Security | Passwords hashed with bcrypt (cost 12); reset tokens and recovery codes stored as SHA-256 hashes; MFA and payment secrets AES-256-GCM encrypted | Verified in source and tests |
| NFR-04 | Security | Security headers (CSP, nosniff, frame options, referrer policy, permissions policy, COOP, HSTS on HTTPS) | Verified (header test); sandbox CSP on `/f` and `/brand` defective in the first audited build (D-02) |
| NFR-05 | Privacy | No raw IP addresses stored; DNT/GPC honoured | Verified in source; scan cap verified by test |
| NFR-06 | Reliability | Quotas, stock-outs, token claims and webhook effects are atomic or idempotent | Verified in source; duplicate-webhook test passed |
| NFR-07 | Reliability | Production server refuses unsafe configuration | Verified (unit tests of `checkEnv`) |
| NFR-08 | Usability | Pages fit 375/768/1280 px without horizontal scrolling | Verified for public and workspace pages by test:browser |
| NFR-09 | Accessibility | Controls, links and images have accessible names | Verified automatically at 1280 px for tested pages; no manual WCAG audit |
| NFR-10 | Maintainability | Type-checked, linted code; CI workflow | Verified (0 type errors, 0 lint errors, 5 warnings) |
| NFR-11 | Portability | SQLite and MySQL from one schema | Verified (test:mysql 32/32 on MySQL 8.4) |
| NFR-12 | Performance | **Target (not measured):** dynamic redirect < 200 ms server time; dashboard pages interactive < 3 s on 4G | Not measured |
| NFR-13 | Scalability | Multiple instances supported with MySQL and `RATE_LIMIT_STORE=database` | Implemented; not load-tested |

## 3.13 User Roles and Access-Control Matrix

Table 3.4: Access-control matrix (✓ allowed, ✗ denied, own = only the actor's own records)

| Function | Visitor | User | Admin | Super admin |
|---|---|---|---|---|
| Public pages, client-side generators, scanner | ✓ | ✓ | ✓ | ✓ |
| Follow dynamic link / hosted page; report abuse | ✓ | ✓ | ✓ | ✓ |
| Save/edit QR codes, products, stock, uploads, analytics | ✗ | own | own (workspace session) | own (workspace session) |
| Subscribe / cancel subscription | ✗ | own | own | own |
| Admin console (requires separate admin sign-in) | ✗ | ✗ | ✓ | ✓ (MFA required) |
| Suspend/reactivate, revoke sessions, reset link, change plan | ✗ | ✗ | ordinary users only | ✓ (not self for status) |
| Change roles, delete accounts | ✗ | ✗ | ✗ | ✓ (not self; not last super admin) |
| Moderate QR codes and reports | ✗ | ✗ | ✓ | ✓ |
| Settings, branding, appearance, e-mail test | ✗ | ✗ | ✓ | ✓ |
| Pricing plans (create/edit/reorder/sync) | ✗ | ✗ | view | ✓ |
| Payment credentials, enable checkout | ✗ | ✗ | view status | ✓ (recent re-authentication) |
| Cancel a user's subscription | ✗ | ✗ | ✗ | ✓ |

## 3.14 External Dependencies and Third-Party Services

Table 3.5: External services

| Service | Use | Required? | Integration point |
|---|---|---|---|
| Razorpay | Subscription plans, checkout, payment fetch, cancellation, webhooks | Optional | `src/lib/razorpay.ts`, `src/lib/billing.ts` |
| Google OAuth 2.0 / OpenID Connect | "Continue with Google" sign-in | Optional | `src/app/api/auth/google/**` |
| SMTP server | Password-reset e-mails; admin test mail | Optional (required in practice for resets) | `src/lib/mail.ts` |
| GitHub Actions | CI | Development only | `.github/workflows/ci.yml` |
| Hosting platform headers (`x-vercel-ip-country`, `cf-ipcountry`) | Country of scans, if present | Optional | `src/lib/scans.ts` |

## 3.15 Configuration and Environment Variables

Only variable **names and purposes** are listed; no values from any environment file were copied into this report.

Table 3.6: Environment variables (from `.env.example` and `src/lib/env-check.ts`)

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Prisma connection string (`file:` for SQLite, `mysql://` for MySQL) | Yes |
| `AUTH_SECRET` | Signs session tokens; ≥ 32 random characters | Yes |
| `NEXT_PUBLIC_APP_URL` | Public origin used for short links, reset links, OAuth callbacks and CSRF origin checks | Yes in production |
| `SETTINGS_ENCRYPTION_KEY` | Key for encrypting payment credentials stored in the database (≥ 32 chars, ≠ `AUTH_SECRET`) | Only to store credentials in DB |
| `MFA_ENCRYPTION_KEY` | Key for encrypting TOTP secrets (falls back to a key derived from `AUTH_SECRET`) | Recommended |
| `TRUST_PROXY` | `true` or `cloudflare` when behind a trusted proxy | Deployment-specific |
| `RATE_LIMIT_STORE` | `memory` (default) or `database` | Recommended `database` for multiple instances |
| `AUDIT_IP_SALT` | Salt for hashed IPs in the audit log | Optional |
| `LOG_LEVEL`, `LOG_FORMAT` | Logging verbosity and format | Optional |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in | Optional (both or neither) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Outgoing e-mail | Optional |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay credentials via environment (alternative to encrypted DB storage) | Optional; webhook secret mandatory if keys set |
| `RAZORPAY_API_BASE` | Override of the Razorpay API address for automated tests only | Never in production |
| `UPLOAD_DIR` | Directory for uploaded files | Optional (default `./uploads`) |
| `DEMO_MODE` | Enables demo data in development; rejected in production | Development only |
| `NEXT_DIST_DIR` | Alternative build directory (used for isolated test builds) | Optional |
| `ADMIN_EMAILS` | Obsolete; grants nothing and triggers a warning | Should be removed |

The local `.env` file in the audited workspace still defines `ADMIN_EMAILS`; the application warns that this variable is obsolete (its value was not inspected).

## 3.16 Requirement Traceability Matrix

Table 3.7: Requirement traceability matrix (summary; full matrix in Appendix H and the XLSX file)

| Req. | Module | Main source | Test evidence | Status |
|---|---|---|---|---|
| FR-01 | Accounts | `api/auth/signup/route.ts` | TC-AUTH-01..04 (test:admin, test:api) | Verified |
| FR-02 | Accounts | `lib/auth-flow.ts`, `lib/session.ts` | TC-AUTH-05..10 | Verified (Google not exercised) |
| FR-03 | Accounts | `api/auth/forgot`, `reset` | TC-AUTH-11..14 | Verified (SMTP delivery not exercised) |
| FR-04 | Accounts | `api/account/**` | TC-AUTH-15..17 | Verified |
| FR-05 | QR | `lib/qr-types.ts`, `lib/qr-render.ts` | TC-QR-01..03 (test:qr) | Verified |
| FR-06 | QR | `lib/qr-service.ts` | TC-QR-04..06 | Verified |
| FR-07 | Dynamic QR | `app/r/[code]/route.ts` | TC-DYN-01..03 | Verified (redirect by suite; pause/expiry/unknown by audit probe) |
| FR-08 | Analytics | `lib/scans.ts` | TC-DYN-04 | Partially verified |
| FR-09 | Barcodes | `lib/barcodes.ts` | TC-BC-01..04 (test:barcodes) | Verified |
| FR-10 | Scanner | `scanner/scanner.tsx` | TC-SCN-01..03 (test:browser) | Verified (Chromium) |
| FR-11 | Products | `lib/products.ts` | TC-PRD-01..09 | Verified |
| FR-12 | Inventory | `moveStock()` | TC-INV-01..05 | Verified |
| FR-13 | Bulk/import | `api/products/import` | TC-PRD-10..11 | Verified (import); bulk UI not individually asserted |
| FR-14 | Uploads | `api/uploads`, `lib/storage.ts` | TC-UPL-01..03 | Partially verified; defect D-01 |
| FR-15 | Entitlements | `lib/entitlements.ts` | TC-BIL-05 (test:billing) | Verified |
| FR-16 | Billing | `lib/billing.ts` | TC-BIL-01..04 (mock Razorpay) | Verified against mock only |
| FR-17 | Admin auth | `api/admin/auth/**`, `lib/mfa.ts` | TC-ADM-01..08 | Verified |
| FR-18 | Admin users | `api/admin/users/**` | TC-ADM-09..14 | Verified |
| FR-19 | Moderation | `api/admin/qrcodes`, `reports` | — | Implemented, not independently verified |
| FR-20 | Configuration | `api/admin/settings`, `branding`, `plans`, `payments/config` | TC-ADM-15..17, TC-BIL-06 | Verified |
| FR-21 | Audit/logs | `lib/audit.ts` | TC-ADM-18 | Verified |
| FR-22 | UPI QR | `lib/upi.ts` | TC-QR-07..08 | Verified |
