# QRSathi — production remediation report

**Date:** 2026-10-26.

**Starting point:** branch `main` at `4b91dbd`, identical to `origin/main`, clean working tree. It includes the 2026-10-25 audit (`docs/audit/2026-10-25-readiness-audit.md`).

**Scope:** fixes at code level only, plus verification against isolated builds, a scratch copy of the database and local mocks.

**Not done (owner approval needed):**
- nothing committed, pushed or deployed;
- no history rewrite;
- no account, role, MFA or database changes;
- no real e-mails, payments or credential changes.

Status labels:

| Label | Meaning |
|---|---|
| **FIXED** | Changed and verified by tests in this round |
| **PASS** | Verified, no change needed |
| **FAIL** | Still broken |
| **BLOCKED** | Needs your credentials, approval or manual action |
| **NOT VERIFIED** | Not checked this round, with the reason given |

---

## 1. Verdict

| Question | Answer |
|---|---|
| Free features to real users on a single server? | **Yes, once the BLOCKED items in §5 marked "production" are done:** real SMTP configured and delivering a reset e-mail on staging, an empty production MySQL database, and legal review of the privacy policy and terms. No code-level blocker remains for the free features. |
| Enable Razorpay checkout? | **No.** Billing is still verified only against a simulated Razorpay. Run the test-mode checklist in §9 on staging first. |
| Publish as open source? | **No.** There's still no licence, and the history still holds the database backup with account data (§8). |

## 2. Findings from the 2026-10-25 audit, re-verified

| # | Finding | Status now | Evidence |
|---|---|---|---|
| 1 | DB backup with personal data in Git history | **BLOCKED** (your approval) | `prisma/dev.db.backup-20261025-121707`: not tracked in `HEAD`; reachable from `21277e0` and `f63c944`, both on `origin/main`. Contents re-checked by row counts only (users with e-mail + bcrypt hash, scans, settings). No other `.db/.sqlite` blob in history. Procedure in §8. |
| 2 | No licence | **BLOCKED** (your decision) | No `LICENSE` file. |
| 3 | SMTP / password reset never tested against a mail server | **PARTIALLY FIXED** | New `test:mail` suite against a local SMTP mock passes 25/25 (§4). Real provider delivery is **NOT VERIFIED**. Production now refuses to start without SMTP on a public origin (§3). |
| 4 | Razorpay only simulated | **BLOCKED** (needs your Razorpay test account) | 8 more mock-based checks added (§4). Still never run against Razorpay itself. |
| 5 | Plain admins usable without 2FA | **FIXED** | MFA now required for every admin role (§3). |
| 6 | Demo administrator in the dev database | **BLOCKED** (your approval); **risk increased** | `admin@demo.local` in `prisma/dev.db` is now a **super admin** (MFA enabled). It was a plain admin yesterday; the change happened outside this session. `db:migrate-data` copies every row. Start production from an empty database (§10). |
| 7 | `RAZORPAY_API_BASE` only warned in production | **FIXED** | Refuses to start on a public origin (§3). |
| 8 | CSP allowed inline scripts | **FIXED** | Per-request nonce + `'strict-dynamic'`; no `'unsafe-inline'` for scripts (§3). |
| 9 | Privacy/terms need legal review | **BLOCKED** (qualified reviewer) | One factual gap fixed: the contact form wasn't disclosed (§3). Checklist in §11. |
| 10 | Accepted dependency advisories | **Mitigation found, not applied** (§3.6) | 5 production advisories unchanged. A tested npm `overrides` entry removes the 4 PostCSS ones; the remaining 3 need Prisma 7. |

## 3. Fixes made and files changed

### 3.1 Fail-closed startup validation

**File:** `src/lib/env-check.ts`.

**Public-origin production (the URL isn't localhost) now refuses to start when:**
- `RAZORPAY_API_BASE` points anywhere but `https://api.razorpay.com`;
- `SMTP_HOST` is missing, unless `MAIL_DISABLED=true` is set on purpose;
- `DATABASE_URL` is SQLite, unless `ALLOW_SQLITE_IN_PRODUCTION=true`.

**Every environment refuses** a `DATABASE_URL` that's neither `mysql://` nor `file:`. For example, `postgres://` gets a clear message; Postgres isn't supported despite two commit messages saying "migrated … to postgres".

**Messages** name the variable, never its value; a test confirms this.

**Local production test servers** (localhost origin) keep warnings, so the automated suites still work.

**Already in place and re-verified:**
- weak or short `AUTH_SECRET`;
- `DEMO_MODE=true` in production;
- a non-https public URL;
- secrets in `NEXT_PUBLIC_*`;
- Razorpay keys without a webhook secret.

**Tests:** `scripts/test-security.mts`, 8 new checks.
- One existing check changed because the policy changed. It expected a warning for `RAZORPAY_API_BASE`; it now expects refusal on a public origin, and a new check covers the warning on localhost.
- Docs: `.env.example` documents `MAIL_DISABLED`, `ALLOW_SQLITE_IN_PRODUCTION` and the `RAZORPAY_API_BASE` rule.

### 3.2 Two-factor authentication for every administrator

| What | File |
|---|---|
| API guard: `admin` and `super_admin` both need MFA | `src/lib/session.ts` |
| Console page guard (redirects to `/admin/mfa`) | `src/lib/guard.ts` |
| Login always signals that MFA setup is needed | `src/app/api/admin/auth/login/route.ts` |
| Turning MFA off is refused for all admins; refusals are audited; dead code removed | `src/app/api/admin/mfa/route.ts` |
| Page copy | `src/app/admin/(console)/mfa/mfa-view.tsx` |
| Role comments corrected (plans/payments are super-admin only, as the code already enforced) | `src/lib/roles.ts` |
| Capability table and MFA section | `docs/ADMIN.md` |

**No lock-out:**
- An admin without MFA can still sign in with their password.
- They reach only the enrolment page until they finish.
- Recovery stays available: recovery codes, `npm run admin -- reset-mfa`, or a super admin.
- No account was changed. Any plain admin without MFA in a database just has to enrol at next sign-in.

**Tests:** `scripts/test-admin.mts`, `scripts/test-billing.mts`, `scripts/test-browser.mts`.
- Three existing expectations changed because the policy changed: "admin (no MFA) can read stats", "admin signs in and returns to ?next", and "/admin/mfa shows *Set up authenticator app*" after enrolment.
- New coverage: a plain admin is blocked from APIs and user mutations, redirected to enrolment, can enrol, can't disable, then signs in with password + TOTP and works normally.

### 3.3 Password reset

**`src/app/api/auth/forgot/route.ts`:**
- The reset e-mail is sent **after** the response (`after()`), so response time no longer reveals whether an account exists.
- Delivery results are audited, and failures are logged (`auth.password_reset_mail_failed`).
- The requester always gets the same generic message.

**Admin "send reset link"** (`src/app/api/admin/users/[id]/route.ts`, `src/app/admin/(console)/users/users-view.tsx`):
- now returns `delivered: false` with an honest message;
- the UI shows a warning instead of a green success when nothing was sent.

**Verified unchanged:**
- 256-bit random tokens, stored only as SHA-256;
- 1-hour expiry, atomic single use;
- older tokens invalidated by a new request;
- all sessions revoked on reset;
- links built from `NEXT_PUBLIC_APP_URL` (no Host-header poisoning);
- per-IP, per-account and global rate limits.

**New suite:** `scripts/test-mail.mts` (`npm run test:mail`).
- An in-process SMTP mock; no new dependency, and no mail leaves the machine.
- Covers delivery, the reset link's origin, token rotation and expiry, single use, session revocation, the old password rejected, a simulated SMTP 550 failure (logged, not revealed), no tokens in logs, and contact-form delivery with Reply-To.
- Added to CI in `.github/workflows/ci.yml`: the server is restarted with the mock, then the suite runs.

### 3.4 Content-Security-Policy with nonces

| What | File |
|---|---|
| CSP builder and nonce generator | `src/lib/csp.ts` (new) |
| Nonce per request; CSP set on every HTML response | `src/middleware.ts` |
| Theme script stamped with the nonce | `src/app/layout.tsx` |
| Global CSP removed; deny-all fallback for API responses; the sandbox CSP for `/f/*` and `/brand/*` stays | `next.config.mjs` |

**`script-src` is now:** `'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval' https://checkout.razorpay.com`, with no `'unsafe-inline'`.

- `'self'` and the Razorpay host only matter to old browsers that ignore `'strict-dynamic'`.
- Styles keep `'unsafe-inline'`, because React style attributes and `next/font` need it.

**Verified:**
- every HTML page renders dynamically, so the nonce is fresh per request;
- all 39 scripts on a sample page carry the nonce;
- the browser suite found no CSP violations on any page at 3 widths in either theme.

**NOT VERIFIED:** Razorpay Checkout's own script under `'strict-dynamic'`. It's loaded by our nonce-trusted bundle, so it should be allowed, but check it in the staging test-mode run (§9, step 4).

### 3.5 Billing test coverage

**`scripts/test-billing.mts`, 8 new checks:**
- `payment.failed` webhook;
- `subscription.completed` (access kept to the end of the period, then the account falls back to Free);
- a verified late charge after completion (honoured, status not revived);
- `subscription.paused` (access ends);
- `subscription.resumed` (doesn't re-grant without a verified charge).

**Harness fix:** each test customer now signs up from its own client IP. The app's 10-per-IP-per-hour sign-up limit is unchanged; the suite simply needed more test customers than that.

### 3.6 Dependency advisories (evaluated in a scratch copy only)

| Package (installed) | Severity | Runtime or build | Exposure | Fix |
|---|---|---|---|---|
| postcss 8.4.31, bundled by next 15.5.28 (GHSA-6g55, -r28c high; -qx2v, -fxqj moderate) | 2 high, 2 moderate | Build time | Only processes this repository's own CSS; no user CSS or source maps | `"overrides": { "postcss": "$postcss" }` in `package.json` |
| deepmerge-ts 7.1.5 via `@prisma/config`/`prisma` 6.19.3 (GHSA-ggr8) | high | CLI only (generate/migrate) | Merges Prisma's own config, never request data | Prisma 7 (major) |

- Next 15.5.28 and Prisma 6.19.3 are already the newest releases in their major versions.
- **Override, tested in a scratch copy:**
  - it installs cleanly;
  - Next then uses PostCSS 8.5.31;
  - `npm audit --omit=dev` goes from 5 to 3;
  - the production build succeeds with **byte-identical CSS output**.
- **Not applied to your project,** because it changes the lockfile. Before applying it, run the full suites in §4.

### 3.7 Privacy policy (factual gap)

`src/app/(site)/privacy/page.tsx` now discloses that contact-form submissions (name, e-mail, topic, message) are e-mailed to the support inbox through the e-mail provider and aren't stored by the website. The legal review must still cover it.

**All changed files:**
- **Modified:** `.env.example`, `.github/workflows/ci.yml`, `docs/ADMIN.md`, `next.config.mjs`, `package.json` (one script: `test:mail`).
- **Modified tests:** `scripts/test-admin.mts`, `scripts/test-billing.mts`, `scripts/test-browser.mts`, `scripts/test-security.mts`.
- **Modified source:**
  - `src/app/(site)/privacy/page.tsx`;
  - `src/app/admin/(console)/mfa/mfa-view.tsx`, `src/app/admin/(console)/users/users-view.tsx`;
  - `src/app/api/admin/auth/login/route.ts`, `src/app/api/admin/mfa/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/app/api/auth/forgot/route.ts`;
  - `src/app/layout.tsx`;
  - `src/lib/env-check.ts`, `src/lib/guard.ts`, `src/lib/roles.ts`, `src/lib/session.ts`;
  - `src/middleware.ts`.
- **New:** `scripts/test-mail.mts`, `src/lib/csp.ts`, this report.

## 4. Tests run (actual results)

Runtime tests used a production build (`.next-test`) on `:3100` against a `VACUUM INTO` copy of `prisma/dev.db`, Razorpay replaced by the suite's mock, and SMTP by `test-mail`'s mock.

| Command | Result |
|---|---|
| `tsc --noEmit` (source) | PASS (stale `.next/types` stubs from your running dev server excluded) |
| `npm run lint` | PASS: 0 errors, the same 4 pre-existing warnings |
| `npm test` (security / QR / barcodes) | PASS: 147 / all QR / 166 |
| `next build` | PASS (all HTML routes dynamic; middleware 37 kB) |
| `test:api` | PASS 82/82 |
| `test:admin` (all sections enabled) | PASS 107/107 (was 99; +8 MFA-policy checks) |
| `test:billing` (Razorpay **mock**) | PASS 139/139 (was 131) |
| `test:mail` (SMTP **mock**) | PASS 25/25 (new) |
| `test:browser` light / dark | PASS 455/455 · 455/455 (was 452; +3 admin-MFA checks) |
| Camera repeats (`CAMERA_ONLY=1`) | PASS 5/5 runs; 28 simulated-webcam decodes today, 0 failures |
| Final rebuild after the privacy-policy edit: API, browser light, browser dark | PASS 82/82 · 455/455 · 455/455 (privacy page served with the new paragraph) |
| `test:mysql` and the app on MySQL | **NOT VERIFIED this round.** Docker Desktop isn't running, and starting it would also restart your other Docker project. No schema or migration file changed since 2026-10-25, when MySQL 8.4 passed migrations 32/32, API 82/82, admin 99/99 and billing 131/131. |
| Real SMTP, real Razorpay, Google OAuth, real devices | NOT VERIFIED (need your accounts or hardware) |

**Camera flakiness:**
- On 2026-10-25, 2 runs out of roughly 6 each failed one simulated-webcam decode.
- One failure was clearly environmental: the simulated camera never started in 30 s.
- The other left too little output to classify.
- None recurred in 7 runs today.
- The test now records the camera state and what was detected when it fails (`scripts/test-browser.mts`); `CAMERA_ONLY=1` allows quick repeats.
- Assessment: environment and timing under load, not a scanner regression. Monitor it in CI.

**Note on the final runs:** the privacy-policy paragraph was added after the main test pass; the final rebuild re-ran API and both browser suites on the finished code. The admin, billing and mail suites ran on the previous build, which differs only by that paragraph.

## 5. Remaining blockers

| Severity | Blocker | Blocks | Needs |
|---|---|---|---|
| **High** | DB backup in Git history (§8) | Open source; any new collaborator | Your approval for a history rewrite and force-push |
| **High** | No licence | Open source | Your decision |
| **High** | Real SMTP delivery unverified | Production | Your SMTP account; staging test (§9) |
| **High** | Razorpay never tested against Razorpay | Paid checkout | Your Razorpay test account; staging (§9) |
| **High** | Dev database contains a super admin at the documented demo address | Production, if the dev DB is ever migrated | Use an empty production DB; optional cleanup (§10) |
| Medium | Legal review of privacy policy and terms | Production | A qualified reviewer (§11) |
| Medium | MySQL suites not re-run this round | Confidence | Start Docker and run §9 step 1 |
| Low | 5 accepted dependency advisories (3 after the override) | Both | Approve the override; plan Prisma 7 before 2027-01-31 |

## 6. Production environment variables (names only)

| Variable | Purpose | Rule enforced at startup |
|---|---|---|
| `DATABASE_URL` | MySQL connection | Must be `mysql://` (or `file:` only with `ALLOW_SQLITE_IN_PRODUCTION=true`) |
| `AUTH_SECRET` | Session signing | ≥ 32 random characters, not a placeholder |
| `NEXT_PUBLIC_APP_URL` | Public https origin | Required; must be https; origin only |
| `DEMO_MODE` | Demo seeding | Must not be `true` |
| `MFA_ENCRYPTION_KEY` | Encrypts admin TOTP secrets | ≥ 32 characters if set (warning if missing) |
| `SETTINGS_ENCRYPTION_KEY` | Encrypts DB-stored Razorpay credentials | ≥ 32 characters; must differ from `AUTH_SECRET` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Password reset, contact form | `SMTP_HOST` required unless `MAIL_DISABLED=true` |
| `MAIL_DISABLED` | Run without e-mail on purpose | Opt-out only |
| `TRUST_PROXY` | Client-IP source behind a proxy | `true`, `cloudflare` or unset |
| `RATE_LIMIT_STORE` | `memory` or `database` | Warning unless `database` |
| `UPLOAD_DIR` | Persistent upload directory | (Must be on persistent storage) |
| `AUDIT_IP_SALT` | Salt for hashed audit IPs | Recommended |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Billing (or set in the console) | Key format checked; webhook secret required with keys |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in | Both or neither |
| `RAZORPAY_API_BASE` | **Tests only** | Refused on a public origin unless it's the real Razorpay API |
| `ALLOW_SQLITE_IN_PRODUCTION` | Accept SQLite deliberately | Opt-out only |
| `LOG_LEVEL`, `LOG_FORMAT` | Logging | — |

## 7. Staging verification steps (owner)

Use a staging host with a real https domain, a fresh MySQL database, and **test** credentials only.

1. **Deploy.**
   - `npm ci`, `npm run db:mysql:deploy`, `npm run build`.
   - Start with the §6 variables. The server must start; deliberately unset `SMTP_HOST` once to see it refuse.
2. **Create an administrator.**
   - `npm run admin -- create --email <you> --super`, then sign in at `/admin/login`.
   - Enrol MFA, store the recovery codes, sign out and back in with a code.
3. **E-mail.**
   - Admin → Email → **Send a test e-mail to me**.
   - Then sign up a test customer with a mailbox you control, use **Forgot password**, and confirm the link opens your staging domain and works once.
   - Submit the contact form and confirm it arrives with Reply-To set.
4. **Free features.** Sign up/in/out; create a static and a dynamic QR; scan the dynamic one with a phone; edit its destination and re-scan; generate and scan a barcode; add a product and stock movement; upload a file.
5. **Headers.**
   - `curl -I https://<staging>/` shows HSTS, a nonce CSP and `nosniff`.
   - The session cookie is `Secure; HttpOnly; SameSite=Lax`.
6. **Backups.** Take a `mysqldump --single-transaction` backup and restore it into a scratch database (see `docs/BACKUP-RECOVERY.md`). Compare row counts.

## 8. Git-history cleanup (awaiting your approval; not executed)

1. **Back up first.**
   - `git clone --mirror https://github.com/druvemedia/qrsathi.git qrsathi-backup.git`
   - Keep this mirror offline: it contains the sensitive file.
2. **Coordinate.** List everyone with access (Settings → Collaborators) and ask them to push any pending work, then pause pushes.
3. **Rewrite** in a fresh clone, never your working folder:
   - `pip install git-filter-repo`
   - `git clone https://github.com/druvemedia/qrsathi.git qrsathi-clean && cd qrsathi-clean`
   - `git filter-repo --path prisma/dev.db.backup-20261025-121707 --invert-paths`
   - Verify: `git log --all -- prisma/dev.db.backup-20261025-121707` prints nothing.
4. **Force-push (controlled):**
   - `git remote add origin https://github.com/druvemedia/qrsathi.git`
   - `git push --force --all` and `git push --force --tags`
   - Temporarily allow force-push in branch protection if it's enabled; re-enable it afterwards.
5. **Purge cached copies.**
   - Delete stale branches and forks you control.
   - Ask GitHub Support to remove cached views and unreferenced objects (mention the commit SHAs `21277e0` and `f63c944`).
   - Pull requests referencing old commits keep them reachable until GitHub purges them.
6. **Clones.**
   - Everyone re-clones; stale clones must not be pushed back, because that would reintroduce the history.
   - Your working folder `C:\Users\mishr\qrsathi` will need a fresh clone too. Keep it until the new clone is verified, and keep its `.env`, `prisma/dev.db` and uploads.
7. **Affected users.**
   - The backup held 3 accounts' e-mail addresses and bcrypt password hashes.
   - Ask those users to change their passwords, and treat the hashes as exposed.
   - No API keys or other secrets were found in history (2026-10-25 scan).
   - Nothing needs rotating apart from those passwords.

## 9. SMTP and Razorpay checks requiring your access

**SMTP:** steps 3 in §7. Delivery is **NOT VERIFIED** until a real reset e-mail arrives and its link works.

**Razorpay test mode (staging, test keys only, checkout enabled in *test* mode):**
1. Optional MySQL re-check first: `MYSQL_TEST_URL="mysql://root:<pw>@127.0.0.1:<port>/" npm run test:mysql` against a throw-away MySQL.
2. Admin → Payment gateway:
   - enter test keys and the webhook secret;
   - press **Test connection** (must say *Verified*);
   - add the webhook URL `https://<staging>/api/billing/webhook` in the Razorpay dashboard with events `subscription.*`, `payment.failed` and `refund.processed`.
3. Plans & pricing: **Sync with Razorpay** for each paid plan.
4. **Successful purchase:**
   - as a test customer, subscribe with Razorpay's test success card;
   - confirm the checkout window opens with no CSP errors in the browser console;
   - the status page goes pending → active only after the webhook;
   - Admin → Payments shows the payment.
5. **Failed payment:** use Razorpay's test failure card. Expect the status page to show the failure, the plan unchanged, and the failure recorded.
6. **Duplicate webhook:** in the Razorpay dashboard, resend a delivered `subscription.charged` event. Expect no second payment and no extra period.
7. **Cancellation:**
   - cancel at period end; expect access kept;
   - then cancel immediately from Admin → Subscriptions; expect access to end.
8. **Refund:** refund the test payment in the dashboard. Expect it marked refunded and access ended.
9. Only then consider live keys, with a small real transaction that you refund.

## 10. Production deployment checklist

| Item | Status |
|---|---|
| Production build | PASS |
| Fail-closed configuration checks | FIXED |
| Server-side authorization, CSRF, rate limits | PASS (suites) |
| MFA for all administrators | FIXED |
| Password-reset logic | PASS (mail mock) |
| Real SMTP delivery | NOT VERIFIED (BLOCKED: your SMTP account) |
| CSP without inline scripts; HSTS on https | FIXED / NOT VERIFIED (HSTS needs an https host) |
| MySQL migrations from empty | PASS on 2026-10-25; NOT VERIFIED today (Docker off; no schema change since) |
| Production database starts empty (no dev data, no demo super admin) | BLOCKED: your action |
| Super admin created via CLI and MFA enrolled | BLOCKED: your action |
| Persistent `UPLOAD_DIR`, single server | NOT VERIFIED (host) |
| Backups scheduled and a restore rehearsed | NOT VERIFIED (staging) |
| Legal review | BLOCKED |
| Razorpay checkout | Keep **disabled** until §9 passes |

**Optional cleanup of the development database:**
- Not needed if production starts empty.
- Run only with your approval, on your machine, after a backup copy of `prisma/dev.db`.
- Option 1: demote the demo super admin with `npm run admin -- demote --email admin@demo.local`.
- Option 2: delete it in Admin → Users as another super admin.

## 11. Open-source publication checklist (separate decision)

| Item | Status |
|---|---|
| Choose a licence. Without one, a public repo grants no right to reuse, modify or redistribute: copyright stays with you by default. | BLOCKED (owner) |
| Purge the DB backup from history (§8) | BLOCKED (owner) |
| Check `docs/mini-project-report/*.docx/.pdf/.xlsx` for personal data, or move them out | NOT VERIFIED |
| Third-party licences documented (`docs/LICENSING.md`: MIT/ISC/Apache/BSD; Inter and Fraunces via OFL; simple-icons CC0 plus trademarks) | PASS |
| No secrets in tracked files or history | PASS (2026-10-25 scan; no new files with secrets) |
| CONTRIBUTING, CODE_OF_CONDUCT, SECURITY.md, templates, Dependabot | PASS |
| CI passes on GitHub | NOT VERIFIED (a Dependabot branch exists on the remote; Actions results not visible without access) |

**Licence options:**
- **MIT or Apache-2.0:** permissive; others may build paid products from it.
- **AGPL-3.0:** anyone who runs a modified hosted copy must publish their changes.
- **Source-available, non-commercial:** not open source by the OSI definition.

All of these are compatible with the current dependencies (`docs/LICENSING.md`).

**For the legal reviewer (do not treat this as legal advice):**
- DPDP Act 2023: notice, consent, a grievance officer (the policy mentions grievances but names no officer), data-principal rights, retention periods (none stated) and breach notification.
- Cross-border processing by providers (hosting, SMTP, Razorpay, Google).
- Contact-form processing (new paragraph).
- Terms:
  - the governing-law clause (`10. Governing law`) needs a real jurisdiction;
  - the liability cap is 3 months of fees;
  - the "non-refundable" wording versus consumer law and Razorpay policy;
  - acceptable use and takedown;
  - dynamic-code availability promises.
- Cookie notice: only essential cookies are used; confirm no consent banner is needed in the target markets.
- Scan analytics: hashed visitor IDs and country data.

## 12. Actions that need your explicit approval

1. Git-history rewrite and force-push (§8), and asking 3 affected users to reset their passwords.
2. Choosing and adding a licence.
3. Sending real e-mails from staging (§7.3) and running Razorpay test-mode purchases (§9).
4. Enabling checkout (test mode, then live).
5. Applying the PostCSS `overrides` to `package.json` and the lockfile (§3.6).
6. Any change to `prisma/dev.db` accounts (§10), and deleting old local backups.
7. Starting Docker Desktop to re-run the MySQL suites (it may also start your other Docker project).
8. Committing and pushing this round's changes.
