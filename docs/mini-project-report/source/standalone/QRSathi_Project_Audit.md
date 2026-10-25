# QRSathi — Project Audit

**Scope:** source code, configuration, database schema and migrations, tests and documentation of the local repository `C:\Users\mishr\qrsathi`.
**Snapshot:** branch `main`, HEAD `9b5dae7` (2026-10-25) **plus uncommitted working-tree changes** (115 entries in `git status` at the final test run, 18:41 IST). The working tree was being edited during the audit; findings note where this mattered.
**Method:** manual source review of every API route and the `src/lib` modules; inspection of `package.json`, lockfile, Prisma schemas, migrations, Next.js configuration, CI workflow and existing docs; execution of all project test suites against an isolated production build and throw-away databases; targeted audit probes. No formal penetration test was performed. No secret values were read or printed (only variable names).

## 1. Summary

QRSathi is a Next.js 15 / React 19 / TypeScript 5.9 full-stack application using Prisma 6.19 with SQLite (development) and MySQL 8 (production target). It implements QR generation (27 types), dynamic QR codes with analytics, a 23-format barcode generator, an in-browser scanner, products and an inventory ledger, bulk tools, an admin console with RBAC and TOTP MFA, branding/pricing configuration and Razorpay subscriptions.

The implementation is of high quality for a mini project: layered architecture, shared validation, revocable server-side sessions, CSRF origin checks, rate limiting, encrypted secrets, idempotent payments and an extensive automated test suite. All type, lint, unit, API, admin/security, billing and MySQL tests passed in the final run; the browser suite passed 445 of 452 checks.

**Most important findings:** (1) uploads over 10 MB fail on paid plans (D-01, verified); (2) a SQLite backup with user data and password hashes remains in Git history (S-01); (3) a sandboxing-CSP override for uploaded files existed in the first audited build and was fixed in the working tree during the audit (S-02); (4) much recent work is uncommitted.

## 2. Project structure

| Area | Location | Notes |
|---|---|---|
| Public site | `src/app/(site)` | home, features, tools, pricing, about, contact, help, privacy, terms, report |
| Auth pages | `src/app/(auth)` | login, signup, forgot/reset password |
| Workspace | `src/app/(app)` | dashboard, generator, barcodes, scanner, scan history, codes, dynamic, UPI, studio, bulk, analytics, products, inventory, billing |
| Admin console | `src/app/admin` | separate `(auth)` and `(console)` groups; 21 console pages plus 2 sign-in pages |
| API | `src/app/api` | [[API_COUNT]] route modules, 89 method handlers |
| Public endpoints | `src/app/r`, `p`, `f`, `brand` | redirect, hosted page, uploaded file, brand image |
| Components | `src/components` | QR workbench, barcode UI, admin shell, pricing cards, UI kit |
| Domain/infra libs | `src/lib` (58 files) | sessions, RBAC, QR, barcodes, products, billing, entitlements, audit, logging, encryption |
| Middleware | `src/middleware.ts` | CSRF origin check |
| Startup check | `src/instrumentation.ts` | fail-closed configuration validation |
| Database | `prisma/schema.prisma`, `prisma/mysql/**` | 22 models; 2 MySQL migrations |
| Scripts | `scripts/` | admin CLI, DB tools, 8 test suites, audit/licence gates |
| CI | `.github/workflows/ci.yml` | quality job + MySQL 8.4 job |

Size: ≈20,200 lines of TS/TSX in `src/`, 57 pages, 67 route handlers, 31 component files; ≈2,700 lines of scripts.

## 3. Technology stack (verified)

| Technology | Version (installed) | Purpose | Evidence |
|---|---|---|---|
| Node.js | 22.22.3 (`engines` ≥22.5.0, `.nvmrc` 22) | Runtime | `package.json`, `.nvmrc`, `node -v` |
| npm | 10.9.8 | Package manager | `npm -v` |
| Next.js | 15.5.28 | App Router, route handlers, middleware | `package.json`, `npm ls` |
| React / React DOM | 19.3.1 | UI | `npm ls` |
| TypeScript | 5.9.3 | Typing | `tsconfig.json`, `npm ls` |
| Prisma / @prisma/client | 6.19.3 | ORM, migrations | `prisma/`, `npm ls` |
| SQLite | Prisma engine | Development DB | `prisma/schema.prisma` provider |
| MySQL | 8.x (tested 8.4) | Production DB target | `prisma/mysql/`, CI, test:mysql |
| Tailwind CSS | 3.4.19 (PostCSS 8.5.31, Autoprefixer 10.6.1) | Styling | `tailwind.config.ts` |
| zod | 4.6.7 | Validation | `src/lib/*` |
| bcryptjs | 2.4.3 | Password hashing (cost 12) | `src/lib/auth-helpers.ts` |
| jose | 5.10.0 | HS256 session tokens | `src/lib/session.ts` |
| qrcode | 1.5.4 | QR matrices | `src/lib/qr-render.ts` |
| bwip-js | 4.11.4 | Barcode encoding | `src/lib/barcodes.ts` |
| zxing-wasm | 3.1.6 | Decoding (browser) | `src/lib/zxing-client.ts` |
| jsqr | 1.4.0 | Post-export scan test | `src/lib/qr-export.ts` |
| jspdf / jszip | 4.2.1 / 3.10.2 | PDF / ZIP export | `src/lib/qr-export.ts` |
| papaparse / read-excel-file / write-excel-file | 5.7.0 / 5.8.8 / 4.1.1 | CSV/XLSX | `src/lib/table-file.ts` |
| recharts | 2.15.4 | Charts | `src/components/charts.tsx` |
| sonner | 1.7.4 | Toasts | bulk, library |
| lucide-react | 1.61.0 | Icons | components |
| clsx / tailwind-merge | 2.1.1 / 2.6.1 | Class helpers | `src/lib/utils.ts` |
| nodemailer | 10.2.1 | SMTP | `src/lib/mail.ts` |
| ESLint | 9.39.5 (+ eslint-config-next 15.5.28) | Lint | `eslint.config.mjs` |
| tsx | 4.23.15 | Script runner | `package.json` scripts |
| sharp | 0.35.5 (dev) | Test image generation | `scripts/test-*.mts` |

Not used despite being common: no Redux, no NextAuth, no Postgres driver (the Git commit messages say "postgres", but the code targets SQLite/MySQL only).

## 4. Feature verification matrix

[[FEATURE_TABLE]]

## 5. Security and reliability audit

### 5.1 Controls present (verified in source; most also by tests)

- **Authentication:** bcrypt cost 12; dummy hash for unknown accounts; one generic error; per-IP, per-account and global rate limits; Google OIDC with state cookie and verified-e-mail requirement.
- **Sessions:** DB-backed sessions referenced by HS256 cookies (HttpOnly; SameSite Lax for users, Strict for admins); new session id per login (fixation); `sessionVersion` revocation; admin 12 h absolute / 2 h idle.
- **Authorization:** deny-by-default `requireUser`/`requireAdmin`; ownership checks returning 404; admin/super-admin rules incl. last-super-admin protection; separate admin console session; super admin must enrol MFA; re-authentication (15 min) for payment credentials.
- **MFA:** RFC 6238 TOTP with ±1 step and atomic replay guard; AES-256-GCM encrypted secrets; 10 hashed single-use recovery codes.
- **CSRF:** Origin check on all non-GET API requests (webhook exempt, signature-verified).
- **Input validation:** zod everywhere; body-size limits; QR/UPI/IFSC/barcode/price validators.
- **SQL injection:** Prisma query builder only; the single raw query is the constant `SELECT 1` health probe (`src/lib/system-status.ts`).
- **XSS:** React escaping; markup rejected in branding/settings; JSON-LD escaping; CSP with `object-src 'none'`, `frame-ancestors 'self'`.
- **Uploads:** extension allow-list + magic bytes; random names outside `public/`; `nosniff`; attachment for Office files; sandbox CSP (after S-02 fix); SVG reject-list for brand assets.
- **Secrets:** env-only; startup refuses `NEXT_PUBLIC_*` secrets; DB-stored credentials sealed with a key that never enters the DB; status APIs never return secrets; logs/audit redacted; client bundle scanned by tests.
- **Payments:** prices server-side; HMAC-SHA256 with constant-time compare; API re-fetch of payment; amount/currency check; unique provider refs; webhook ledger.
- **Privacy:** no raw IPs; salted truncated hashes; DNT/GPC honoured; bots excluded.
- **Reliability:** transactional quotas (`quotaLock`), conditional stock decrement, atomic token claims, fail-closed startup, health endpoint.

### 5.2 Findings

| ID | Severity | Finding | Evidence | Impact | Recommended remediation |
|---|---|---|---|---|---|
| S-01 | High | SQLite backup with 3 user accounts (bcrypt hashes) and other data in Git history | `git log --all --name-only` shows `prisma/dev.db.backup-20261025-121707` in commit `21277e0`; also documented in `docs/OPEN-SOURCE-READINESS.md` | Personal data and hashes exposed if the repo is/was public | With owner approval: `git filter-repo` history rewrite, force-push, GitHub cache purge; rotate affected passwords; delete demo admin accounts |
| S-02 | Medium | Global CSP header overrode the sandbox CSP of `/f/*` and `/brand/*` | test:billing first run 126/2; `curl -I /f/...` showed global CSP | Uploaded SVG/PDF opened directly not sandboxed | Fixed in working tree (`next.config.mjs` path rules); final run 128/0 — **commit it** |
| S-03 | Medium | MFA mandatory only for `super_admin`; `admin` accounts can operate without MFA | `requireAdmin()`; banner in console | Admin account takeover risk | Enforce MFA for all admins |
| S-04 | Medium (deployment) | Rate limits in memory by default; client IP from right-most `X-Forwarded-For` without `TRUST_PROXY` | `src/lib/rate-limit.ts`, `src/lib/api.ts` | Per-IP limits spoofable / not shared across instances (per-account and global limits still apply) | Set `TRUST_PROXY` and `RATE_LIMIT_STORE=database` in production |
| S-05 | Medium | Dynamic QR destinations not checked against URL reputation | `createQr()` | Platform abuse for phishing | Add Safe Browsing-style checks; keep moderation |
| S-06 | Low–Medium | CSP allows `'unsafe-inline'` scripts | `next.config.mjs` | Weaker XSS defence-in-depth | Nonce-based CSP |
| S-07 | Low–Medium | 5 dependency advisories accepted until 2027-01-31 (postcss ×4, deepmerge-ts) | `npm run audit:check`; `security/audit-allowlist.json` | Known vulnerable transitive packages | Upgrade before expiry |
| S-08 | Low–Medium | No e-mail verification at sign-up | signup route | Spam/fake accounts | Verification e-mail |
| S-09 | Low | No breached-password check | `passwordSchema` | Weak reused passwords | HIBP k-anonymity check |
| S-10 | Low | Uploaded files are public to anyone who knows the 128-bit random name | `/f/[name]` | By design for File QR codes; links can be shared onward | Document; optional expiring links |
| S-11 | Low | Duplicate-SKU check runs before the transaction; a concurrent duplicate hits the DB unique constraint and returns a generic 500 instead of 409 | `createProduct()` (source review; not reproduced) | Confusing error, no data corruption | Map Prisma `P2002` to 409 |
| S-12 | Low | `POST /api/products` uses `req.json()` without the shared size-limited `readJson` and has no per-user rate limit | `src/app/api/products/route.ts` | Resource use by authenticated users | Use `readJson` and a rate limit |
| S-13 | Info | In development without SMTP, password-reset e-mails (including the link) are printed to the console | `src/lib/mail.ts` (non-production only) | Tokens in dev logs | Acceptable for development; never set `NODE_ENV` ≠ production in prod |
| S-14 | Info | No scheduled purge of expired sessions, logs, scans | source | Table growth | Add a periodic clean-up job |
| P-01 | Medium (process) | Large amount of security-relevant work uncommitted during the audit | `git status` 112→115 entries | Risk of loss; unreviewed changes | Commit, tag and run CI |

## 6. Database audit

- 22 models: 15 connected by foreign keys, 7 standalone (AbuseReport, WebhookEvent, BrandAsset, Log, Setting, AuditLog, RateLimit). See `QRSathi_Database_Design.md`.
- Primary keys: CUIDs, except `PricingPlan.id`, `Setting.key`, `RateLimit.key`.
- Unique constraints enforce tenancy rules (`Product(userId, sku)`, `Barcode(userId, format, value)`) and idempotency (`Payment.providerRef`, `WebhookEvent(provider, eventId)`).
- Cascades: deleting a user deletes owned data; `Download.qrId` and `Payment.subscriptionId` set null; `ProviderPlan → PricingPlan` restricts.
- **SQLite/MySQL compatibility: genuinely supported.** The MySQL schema is generated (`npm run db:mysql:schema`; check passes), two MySQL migrations exist, and `npm run test:mysql` passed 32/32 on MySQL 8.4 (round-trip of IDs, timestamps, Unicode, long strings, money; case-sensitive short codes; safe failure of the data-migration script). SQLite development uses `prisma db push` (no migration history). Production MySQL deployment itself was not verified.
- Provider differences handled: MySQL column types for long text, case sensitivity of identifiers, `relationMode = "foreignKeys"`. Search uses `contains`, which is case-insensitive on MySQL's default collation and case-sensitive on SQLite for non-ASCII text.
- No real user data or hashes were read for this audit; the existing `prisma/dev.db` and backups were not opened.

## 7. Test and execution audit

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass with 5 warnings |
| `npm test` | 134 passed (security); QR suite all passed; 166 passed (barcodes) |
| `npx prisma validate`, `npm run db:mysql:schema -- --check` | Pass |
| `npm run audit:check`, `npm run license:check` | Pass (5 advisories accepted) |
| `next build` (isolated `.next-audit`) | Pass |
| `test:api` | 73/0 |
| `test:admin` | 99/0 |
| `test:billing` | 128/0 (first run 126/2 → S-02) |
| `test:browser` | 445/7 (D-03 overflow, D-04 stale expectations) |
| `test:mysql` (MySQL 8.4 Docker) | 32/0 |
| Audit probes | upload sizes (D-01 confirmed); 7/7 gap cases passed |

Details: `QRSathi_Test_Report.md`.

## 8. Known defects

[[DEFECT_TABLE]]

## 9. Limitations of this audit

- External services (Google OAuth, SMTP, live Razorpay) were not exercised.
- No penetration test, no load/performance test, no code-coverage measurement.
- Browser testing on Chromium (Edge) only.
- The GitHub repository was not accessed; the local copy is the source of truth.
- Working tree changed during the audit; results reflect the 18:41 IST snapshot.

## 10. Recommendations (priority order)

1. Fix D-01 (exclude `/api/uploads` from the middleware matcher or raise the middleware body limit) and add a regression test.
2. Commit the working tree (including the S-02 fix), tag a release and let CI run.
3. Clean the Git history (S-01) before making the repository public; rotate affected credentials.
4. Enforce MFA for all administrators; set `TRUST_PROXY` and `RATE_LIMIT_STORE=database` in production.
5. Update stale browser-test expectations (D-04) and fix the pricing-editor overflow (D-03).
6. Validate admin-assigned plans against the database (D-05); map unique-constraint errors to 409 (S-11).
7. Add e-mail verification, URL reputation checks and nonce-based CSP.
8. Add coverage reporting, Firefox/Safari tests and a load-test baseline.
