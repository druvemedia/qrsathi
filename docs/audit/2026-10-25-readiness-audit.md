# QRSathi — production and open-source readiness audit

**Date:** 2026-10-25 · **Scope:** working tree of `C:\Users\mishr\qrsathi` (branch `main`, HEAD `c81d0f4`, 82 uncommitted paths) · **Method:** read-only source review plus runtime tests against isolated builds and throw-away databases. Nothing was committed, pushed, deployed or migrated against a real database. No secret values are reproduced here.

Labels used: **VERIFIED** (checked at runtime or in code during this audit) · **NOT VERIFIED** (could not be checked safely or needs your credentials) · **RECOMMENDATION**.

---

## A. Executive verdict

| | Verdict |
|---|---|
| **Production** | **CONDITIONALLY READY** — the core product (QR, barcodes, scanner, products/inventory, accounts, admin console) is ready for a **single-server** deployment on MySQL **after the P0 items in section I**. Paid billing and e-mail are **NOT VERIFIED** against the real services and must not be switched on for customers until they are. |
| **Open source** | **NOT READY** — no licence file, and the Git history (already on `origin/main`) contains a database backup with real accounts' e-mail addresses and password hashes. |
| **Overall** | **Neither yet.** Production is close; open source needs owner decisions first. |
| **Confidence** | High for code paths covered by the 1,600+ automated checks below; medium for deployment, because no real host, domain, TLS, SMTP, Google OAuth or Razorpay account was available. |

## B. Readiness scorecard

No numeric score is given: a single Critical item would be hidden by an average.

| Category | Status | Evidence | Risk | Required action |
|---|---|---|---|---|
| Authentication & sessions | PASS | bcrypt; server-side sessions; `HttpOnly; Secure; SameSite=Lax` cookie observed; login limits 5/acct + 10/IP per 15 min (admin) in `src/lib/auth-flow.ts`; admin suite 99/99 | Low | — |
| Admin MFA | PARTIAL | Enforced for `super_admin` only (`src/lib/session.ts:145`); plain `admin` accounts can use the console without 2FA (banner only) | Medium | Require MFA for all admin roles (P1) |
| Authorization | PASS | Every `src/app/api/**` route maps to `requireUser`/`requireAdmin`; plans, payment config, subscriptions, role changes require `superAdmin: true`; IDOR checks in `test:api`/`test:admin` pass | Low | Fix comment drift in `src/lib/roles.ts` (says admins manage plans; code requires super admin) |
| App/API security | PASS with notes | Escaped SVG text, sanitised colours/logos, `http(s)`-only redirects and scanner links behind confirmation, random upload names with regex guard, CSRF origin check, no CORS headers, security headers present | Medium | CSP allows `'unsafe-inline'` scripts (P2); `RAZORPAY_API_BASE` override only warns in production (P1) |
| Secrets in Git | PASS for secrets / **FAIL for data** | No live keys/passwords in tracked files or history; matches are a placeholder and a CI-only MySQL password. **But** `prisma/dev.db.backup-20261025-121707` (added `21277e0`, deleted `f63c944`) is still in history on `origin/main`: 3 user rows with e-mails and bcrypt hashes, 1,025 scans, settings | **High** (open source) | See G |
| Dependencies | ACCEPTED RISK | `npm audit --omit=dev`: 4 high + 1 moderate, all in Next's bundled PostCSS (build-time) and Prisma CLI's `deepmerge-ts`; allow-listed until 2027-01-31 in `security/audit-allowlist.json`; fixes need Next 16 / Prisma 7 | Medium | Plan the major upgrades before the allow-list expires (P2) |
| Database (MySQL) | PASS | Fresh MySQL 8.4: migrations apply, `migrate status` no drift, re-deploy is a no-op; data-copy fidelity suite 32/32; **app itself on MySQL**: API 82/82, admin 99/99, billing 131/131 | Low | — |
| Backups & restore | PARTIAL | MySQL `mysqldump --single-transaction` → restore into new DB: 23 tables, identical row counts and checksums (tables were near-empty after test cleanup). SQLite `VACUUM INTO` snapshots restore and run (used as the test DB) | Medium | Rehearse a restore with production-sized data on staging (P1) |
| Payments (Razorpay) | NOT VERIFIED (real gateway) | 131/131 billing checks pass against a **deterministic mock**: signature checks, server-side pricing, replay/duplicate webhooks, cross-mode, refunds, quota races. Never run against Razorpay test or live mode | **High** if enabled unverified | Full test-mode purchase, renewal, failure, refund and webhook run on staging before enabling checkout (P1) |
| E-mail (SMTP) | NOT VERIFIED | No SMTP in any test environment; password reset and the contact form depend on it. The contact form correctly hides itself without SMTP (tested) | **High** for production | Configure SMTP and send a real reset e-mail on staging (P0) |
| Google sign-in | NOT VERIFIED | Code present (`src/app/api/auth/google/*`); never exercised | Medium | Test on staging or leave unset (P1) |
| Tests | PASS | See E; one flaky camera test (simulated webcam) | Low | Stabilise camera test (P2) |
| Deployment | PARTIAL | Production refuses to start with `DEMO_MODE=true` or a weak `AUTH_SECRET` (verified); health endpoint exposes only `{"status":"ok"}`; no Dockerfile; no graceful-shutdown hook; uploads on local disk; rate limits per process by default | Medium | Single instance only unless uploads move to shared storage and `RATE_LIMIT_STORE=database` (P1 for multi-instance) |
| Privacy & legal | NOT VERIFIED | Privacy/Terms pages are explicitly templates; account deletion exists; no third-party trackers; no self-service export of a user's own data | Medium | Legal review (DPDP Act 2023); decide on data export (P0 legal review) |
| Documentation | PASS with drift | README/ADMIN/DATABASE/BILLING/DEPLOYMENT/SECURITY docs match code; commit messages `f63c944`/`9b5dae7` say "postgres" but no PostgreSQL support exists | Low | Note in release notes |
| Licensing | **FAIL** | No `LICENSE` file; `docs/LICENSING.md` says "not chosen" | **Blocks open source** | Owner chooses a licence |
| CI/CD | PARTIAL | `.github/workflows/ci.yml` runs typecheck, lint, schema check, licence + audit gates, unit, build, API/admin/billing/browser on SQLite, and MySQL migrations. App-on-MySQL is not in CI. Whether CI has ever run on GitHub: NOT VERIFIED | Medium | Add an app-on-MySQL job (P2) |
| Maintainability | PASS | Strict TypeScript, zod on every input, consistent API errors, shared UI/admin primitives; 0 lint errors | Low | — |

## C. Critical blockers

| # | Severity | Component | Evidence | Impact | Fix | Owner approval? |
|---|---|---|---|---|---|---|
| 1 | **High** | Git history: `prisma/dev.db.backup-20261025-121707` | `git log --all -- prisma/dev.db.backup-20261025-121707` → `21277e0` (add), `f63c944` (delete); both on `origin/main`. Contains 3 users (e-mail + bcrypt hash), 5 QR codes, 1,025 scans, settings | Anyone who ever gets read access (collaborator, or public later) can read those accounts and attempt offline password cracking | Before making the repo public **or** adding collaborators: rewrite history (e.g. `git filter-repo --path prisma/dev.db.backup-20261025-121707 --invert-paths`), force-push, ask GitHub support to purge cached refs. Regardless: have those 3 users change passwords; treat the hashes as exposed | **Yes** — history rewrite and force-push |
| 2 | **High** | Licence | No `LICENSE` at repo root | Public visibility grants no reuse rights; contributors can't contribute safely | Choose a licence (see `docs/LICENSING.md`) | **Yes** |
| 3 | **High** | Password reset / e-mail | No SMTP verified anywhere | Users who forget passwords are locked out in production | Configure SMTP; verify a real reset on staging | Needs your SMTP account |
| 4 | **High** (if billing enabled) | Razorpay | Only mock-tested | Real money flows unproven | Staging run in Razorpay test mode, then a small live transaction you refund | Needs your Razorpay account |
| 5 | Medium | Admin MFA | `src/lib/session.ts:145` enforces MFA only for `super_admin` | A phished `admin` password gives access to all user accounts' e-mails, suspensions and moderation | Require MFA for every admin role | Policy decision |
| 6 | Medium | Demo admin `admin@demo.local` | Present in `prisma/dev.db` (role `admin`, no MFA). `npm run db:migrate-data` copies **all** rows | If the dev database is migrated to production, a known demo admin goes with it | Delete it before any SQLite → MySQL copy, or start production from an empty database | **Yes** — account deletion |
| 7 | Medium | Legal | Privacy/Terms are templates | Compliance risk | Qualified legal review | Yes |
| 8 | Medium | `RAZORPAY_API_BASE` | `src/lib/env-check.ts:45` warns but starts | A mis-set variable would send payment verification elsewhere | Refuse to start in production unless an explicit test flag is set | No |

## D. Go-live checklists

### Production launch
| Item | Status |
|---|---|
| Production build succeeds | PASS |
| Typecheck / lint (0 errors) / unit tests | PASS |
| API, admin, billing suites on SQLite **and** MySQL 8.4 | PASS |
| Browser suite, light and dark, 3 widths | PASS (1 flaky camera check, see E) |
| MySQL migrations on a clean database, no drift | PASS |
| Refuses unsafe config (`DEMO_MODE`, weak `AUTH_SECRET`) | PASS |
| Server-side authorization on every API route | PASS (code review + tests) |
| Super-admin-only plan/payment/role actions | PASS |
| MFA for all administrators | FAIL (super admins only) |
| SMTP / password-reset e-mail delivered | NOT VERIFIED |
| Razorpay test-mode end-to-end on staging | NOT VERIFIED |
| Google sign-in | NOT VERIFIED (or leave disabled) |
| HTTPS, HSTS, secure cookies behind your proxy | NOT VERIFIED (HSTS is sent only over HTTPS; no host tested) |
| `TRUST_PROXY` set correctly for your proxy | NOT VERIFIED |
| Backup and restore rehearsed with real-sized data | NOT VERIFIED (procedure verified on near-empty data) |
| Monitoring / alerting on errors | FAIL (logs only; no external error reporting) |
| Demo admin removed from any data you migrate | FAIL (still in `dev.db`) |
| Privacy policy and terms reviewed | NOT VERIFIED |
| Multi-instance readiness | FAIL by design (local uploads, in-memory limits by default) — single server is fine |

### Open-source publication
| Item | Status |
|---|---|
| `LICENSE` present | FAIL |
| No personal data in Git history | FAIL (blocker 1) |
| No secrets in tracked files or history | PASS |
| `.env.example` placeholders only | PASS |
| `.gitignore` covers `.env`, `*.db`, backups, uploads | PASS |
| README clean-checkout instructions | PASS (code review; a clean-clone run on another machine is NOT VERIFIED) |
| CONTRIBUTING, CODE_OF_CONDUCT, SECURITY.md, issue/PR templates, Dependabot | PASS |
| CI runs meaningful checks | PASS (has it run on GitHub: NOT VERIFIED) |
| Third-party licences documented (incl. simple-icons CC0 + trademarks) | PASS (`docs/LICENSING.md`) |
| Demo data/accounts cannot reach production by default | PASS (seed refuses in production; production refuses `DEMO_MODE`) |
| Binary docs (`docs/mini-project-report/*.docx/.pdf/.xlsx`) free of personal data | NOT VERIFIED (binary; text files are clean) |
| Remote repository visibility | NOT VERIFIED (unauthenticated API returns 404 → private or absent) |

## E. Test results

Runtime verification used a production build (`NEXT_DIST_DIR=.next-test`) on `:3100` against a `VACUUM INTO` copy of `prisma/dev.db`, and a separate copy of the project built against a disposable MySQL 8.4 container (`127.0.0.1:33306`, removed afterwards). Razorpay was replaced by the test suite's mock.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS — 0 errors, 4 warnings (files not changed recently, incl. one in `docs/mini-project-report`) |
| `npm test` (security unit + QR render/decode + barcodes) | PASS — 139 / all QR / 166 |
| `npm run license:check` | PASS |
| `npm run audit:check` | PASS (5 allow-listed advisories, see B) |
| `npm ls --all` | PASS (lockfile consistent) |
| `node scripts/db/mysql-schema.mjs --check`, `prisma validate` | PASS |
| `next build` (SQLite and MySQL variants) | PASS |
| `test:api` | PASS 82/82 (SQLite) · 82/82 (MySQL) |
| `test:admin` with `BUILD_DIR`, `TEST_*` (all sections) | PASS 99/99 (SQLite) · 99/99 (MySQL); includes "no server secrets in 214 client files" |
| `test:billing` (Razorpay **mock**) | PASS 131/131 (SQLite) · 131/131 (MySQL) |
| `test:browser` light / dark | PASS 452/452 · 452/452 this run. Earlier today two dark runs each failed one simulated-webcam decode (Code 128, then Data Matrix) — **flaky** |
| `test:mysql` (MySQL 8.4) | PASS 32/32 |
| Unsafe-config start-up (`DEMO_MODE=true`; weak `AUTH_SECRET`) | PASS — refused to start |
| MySQL dump → restore round trip | PASS (23 tables, identical counts and checksums; little data) |

**Not run:** real Razorpay, real SMTP, Google OAuth, real-device camera (iOS Safari, Android Chrome, Firefox), load tests, multi-instance behaviour, a clean clone on a second machine.

**Test-quality notes:**
- Billing correctness rests on a mock that mirrors Razorpay's documented API; real webhook payload shapes and retry timing are unproven.
- The browser suite checks layout, CSP, console errors and accessible names, not visual correctness.
- Earlier today one accessibility check was corrected because it treated content inside closed `<details>` elements as visible (documented in the redesign report).
- Integration suites need several environment variables to run fully; without `BUILD_DIR`/`TEST_*`, `test:admin` silently skips sections (93 instead of 99 checks).

## F. Environment and deployment

| Variable | Purpose | Required in production | Verify safely by |
|---|---|---|---|
| `DATABASE_URL` | `mysql://…` connection | Yes | `npm run db:mysql:deploy` on staging; admin → System shows provider/latency |
| `AUTH_SECRET` | Session signing, ≥ 32 random chars | Yes | Server refuses to start if weak (verified) |
| `NEXT_PUBLIC_APP_URL` | Public https origin; used for short links and CSRF | Yes | Must be `https://`; dynamic QR links must use it |
| `DEMO_MODE` | Must be `false` | Yes | Server refuses to start if `true` (verified) |
| `MFA_ENCRYPTION_KEY` | Encrypts admin TOTP secrets | Strongly recommended | Startup warns when missing (observed) |
| `SETTINGS_ENCRYPTION_KEY` | Encrypts DB-stored Razorpay credentials | If entering credentials in the console | Admin → Payment gateway shows storage availability |
| `TRUST_PROXY` | How to read the client IP (`true`, `cloudflare`, empty) | Yes behind a proxy | Rate limits and audit IPs behave per client |
| `RATE_LIMIT_STORE` | `memory` or `database` | `database` if > 1 instance | Admin → System |
| `UPLOAD_DIR` | Upload folder (local disk) | Yes (persistent volume) | Upload, restart, file still served |
| `AUDIT_IP_SALT` | Salt for hashed IPs in the audit log | Recommended | — |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Password reset, contact form | Yes | Admin → Email → "Send a test e-mail" |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Billing (or enter in console) | Only if billing | Admin → Payment gateway → Test connection; then a test-mode purchase |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in | Optional | Sign in on staging |
| `LOG_LEVEL`, `LOG_FORMAT` | Logging | Optional | — |
| `RAZORPAY_API_BASE` | **Test-only** mock override | Must be **unset** | Startup warning if set |
| `MYSQL_URL`, `SQLITE_URL` | Only for `npm run db:migrate-data` | No | — |

**Deployment procedure (single server, MySQL):**
1. Create the database (utf8mb4) and a least-privilege user (`docs/DATABASE.md`).
2. Set the variables above.
3. `npm ci`.
4. `npm run db:mysql:deploy`.
5. `npm run build`.
6. `npm start` behind a TLS proxy.
7. `npm run admin -- create --email … --super`, then enrol MFA.

*[staging first]*:
- Smoke-test sign-up, password reset e-mail, dynamic QR redirect, scanner, admin.
- Then the Razorpay test-mode run.
- Then rehearse backup/restore with real data.

**Migrating existing SQLite data:**
- `npm run db:migrate-data -- --dry-run`, then a real run into an **empty** MySQL database.
- *[owner approval]* Decide first whether development data (demo users, demo admin) should go to production at all.

**Rollback:** see `docs/DATABASE.md`.
- The second migration is additive.
- Restore from backup, or redeploy the previous release.

## G. Security and Git history findings

1. **Tracked now:**
   - No secrets.
   - `.env`, every `*.db` and backup, and `uploads/*` are ignored; only `uploads/.gitkeep` is tracked.
   - `.github/workflows/ci.yml` and `docs/mini-project-report/source/08-references-appendices.md` contain the **CI-only** MySQL service password (it matches the throw-away CI container).
   - Harmless, but you may want to remove it from the report document.
2. **Local only:**
   - `.env` (contains `DEMO_MODE`, an obsolete `ADMIN_EMAILS`, `AUTH_SECRET`; values not shown).
   - `prisma/dev.db` and four backups (`prisma/dev.db.backup-*`, `prisma/backups/*`).
   - All contain account data; keep them off any shared drive.
3. **History (local and on `origin/main`):**
   - `prisma/dev.db.backup-20261025-121707` — blocker 1.
   - Deleting it in `f63c944` did **not** remove it from history.
   - `.env.example` in `21277e0` held a placeholder `AUTH_SECRET` (not reused; current secret differs).
4. **Needs remote or GitHub access (NOT VERIFIED):**
   - Repository visibility and collaborators.
   - Forks/clones made while the backup was in history.
   - Whether GitHub Actions ever ran and kept logs.
   - Branch protection.

## H. Open-source publication checklist (owner actions)

1. Choose and add a `LICENSE`; update `docs/LICENSING.md` and the README notice.
2. Purge `prisma/dev.db.backup-20261025-121707` from history and force-push; contact GitHub support for cached refs; ask the 3 affected users to reset passwords.
3. Check the binary documents in `docs/mini-project-report/` for personal data, or move the folder out of the public repo.
4. Do a clean clone on another machine following the README; run `npm test` and the integration suites.
5. Confirm GitHub Actions passes on the default branch; enable branch protection and secret scanning / push protection.
6. Decide what the published project includes (code only; no deployment of your hosted service, Razorpay account or brand assets).

## I. Remediation roadmap

| Priority | Task | Blocks |
|---|---|---|
| P0 | Purge the DB backup from Git history; affected users change passwords | Open source (and any new collaborator) |
| P0 | Add a licence | Open source |
| P0 | Configure and verify SMTP (password reset) | Production |
| P0 | Start production from an empty MySQL database, or delete demo accounts before migrating data | Production |
| P0 | Legal review of privacy policy and terms | Production |
| P1 | Razorpay test-mode end-to-end on staging before enabling checkout | Paid billing |
| P1 | Require MFA for all admin roles | Production (recommended before inviting other admins) |
| P1 | Refuse to start in production when `RAZORPAY_API_BASE` is set | Paid billing |
| P1 | Rehearse backup and restore with real-sized data; schedule backups | Production |
| P1 | For more than one instance: shared upload storage and `RATE_LIMIT_STORE=database` | Scaling |
| P1 | Google sign-in on staging, or leave unset | That feature |
| P2 | Error reporting/alerting; graceful-shutdown handling; document connection-pool limits | Production quality |
| P2 | Plan Next 16 / Prisma 7 upgrades before the audit allow-list expires (2027-01-31) | Both |
| P2 | Tighten CSP (nonces instead of `'unsafe-inline'`) | Both |
| P2 | App-on-MySQL CI job; stabilise the camera test | Both |
| P2 | Self-service export of a user's data (if legal review requires it) | Production |
| P3 | Fix comment drift in `src/lib/roles.ts`; Users table plan filter from configured plans | — |

## J. Final decision

1. **Deploy to real users today?**
   - **Not yet.** After the P0 production items, a single-server launch of the free features is reasonable: SMTP working, empty production database or demo accounts removed, legal pages reviewed.
   - Keep paid checkout **off** until the P1 Razorpay staging run passes.
2. **Publish as open source today?**
   - **No.** There's no licence, and the history contains real accounts' e-mails and password hashes.
3. **Exact blockers:** section C, items 1–4 (plus 6–7 for production).
4. **Minimum safe path:**
   - licence;
   - history purge plus password resets;
   - SMTP;
   - fresh production database;
   - legal review;
   - staging run of reset e-mail and dynamic QR.
   - Billing comes after the Razorpay test-mode run.
5. **Needs your credentials, staging or confirmation:**
   - GitHub (visibility, Actions, history rewrite);
   - SMTP provider;
   - Razorpay test/live accounts;
   - Google OAuth client;
   - the production host, domain, TLS and proxy;
   - a staging database for restore rehearsal;
   - deleting the demo admin;
   - licence choice;
   - legal review.
