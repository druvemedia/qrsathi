# QRSathi — production readiness update

**Date:** 2026-10-26 (second report today). It follows `docs/audit/production-remediation-report-2026-10-26.md`.

**Starting point:**
- branch `main` at `4b91dbd` (= `origin/main`);
- the 25 uncommitted changes from the remediation round, all intact.

**This round:**
- re-verified those changes;
- applied and tested the PostCSS override;
- wrote the staging checklist;
- expanded the Git-history cleanup plan.

**Not done:** nothing committed, pushed or deployed. No history rewrite, no Docker start, no account or data changes, no real e-mail or payment.

| Label | Meaning |
|---|---|
| **PASS** | Executed in this round and succeeded |
| **FAIL** | Executed and failed (none) |
| **BLOCKED** | Needs your credentials, approval or action |
| **NOT VERIFIED** | Not executed, with the reason given |

## 1. Verdict (unchanged in substance)

| | |
|---|---|
| Free features, single server | **Ready after your staging run.** No code blocker remains. Still BLOCKED on: real SMTP delivery (staging §3), an empty production MySQL database, and legal review. |
| Razorpay checkout | **Keep disabled; test mode only on staging.** Billing logic passes 139/139 against a **simulated** Razorpay. It has not been tested against Razorpay. |
| Open source | **Not ready.** No licence, and the database backup is still in history on **every** branch and PR ref on GitHub (§4). |

## 2. The 25 previous changes — re-verified

- The full source diff was re-read.
- Behaviour checked against the code:
  - MFA enforcement: page guard, API guard, login, MFA route;
  - fail-closed startup rules;
  - the reset e-mail sent after the response;
  - CSP nonce handling in the middleware and layout;
  - CSRF still enforced on `/api/*`.
- No defects found.
- All tests in §3 were run on the current tree.

## 3. Tests run in this round (actual results)

**Environment:**
- production build (`.next-test`) on `:3100`;
- a fresh `VACUUM INTO` copy of `prisma/dev.db` (development database untouched);
- simulated Razorpay inside `test:billing`;
- local SMTP mock inside `test:mail`.

| Check | Result |
|---|---|
| `tsc --noEmit` (source) | **PASS** (0 errors; stale `.next/types` stubs from your running dev server excluded) |
| `npm run lint` | **PASS**: 0 errors, the same 4 pre-existing warnings (files untouched: `docs/mini-project-report/…/schema-dict.mjs`, `postcss.config.mjs`, `src/app/(app)/products/products-list.tsx`) |
| `npm test` (security / QR render-and-decode / barcodes) | **PASS**: 147 / all QR / 166 |
| `npm ls --all` | **PASS** |
| `npm run license:check` | **PASS** |
| `npm run audit:check` | **PASS** (1 accepted advisory, see §5) |
| `next build` | **PASS** |
| `test:api` | **PASS** 82/82 |
| `test:admin` (all sections enabled) | **PASS** 107/107 |
| `test:billing` (**simulated** Razorpay) | **PASS** 139/139 |
| `test:browser` light | **PASS** 455/455 |
| `test:browser` dark | **PASS** 455/455 |
| `test:mail` (**SMTP mock**; server restarted with the mock) | **PASS** 25/25 |
| `test:mysql` and the app on MySQL | **NOT VERIFIED.** Docker isn't running (`docker info` can't reach the engine), and per your instruction it wasn't started. No file under `prisma/` changed since the last passing MySQL run (2026-10-25: migrations 32/32, API 82/82, admin 99/99, billing 131/131). |
| Real SMTP delivery | **BLOCKED** (your SMTP account) |
| Real Razorpay (test mode) | **BLOCKED** (your Razorpay test account) |
| Google sign-in | **BLOCKED** (OAuth client) |
| Real phones (camera scanning, printed codes) | **NOT VERIFIED** (hardware) |
| Production / staging host, HTTPS, HSTS | **NOT VERIFIED** (no host) |

## 4. PostCSS override — applied and kept

**Change** (`package.json`): `"overrides": { "postcss": "$postcss" }`. It makes Next use the project's own PostCSS (8.5.31) instead of its bundled 8.4.31.

**How it was applied:**
- `npm install --ignore-scripts`, so Prisma's engine file wasn't touched while your dev server runs.
- The override changes no Prisma or scanner packages.
- Backups of the previous `package.json`/`package-lock.json` were kept outside the project for this session.

**Lockfile diff:** only the removal of the `node_modules/next/node_modules/postcss` 8.4.31 entry (28 lines). No other package version changed. `npm ls` reports `postcss@8.5.31 overridden`, deduped for `next` and `autoprefixer`.

**Effect:**
- `npm audit --omit=dev` went from 5 advisories (4 high, 1 moderate) to 3 (3 high), all in the Prisma CLI chain.
- The 4 now-stale PostCSS entries were removed from `security/audit-allowlist.json`, so the allow-list only accepts advisories that still exist.
- `docs/SECURITY-AUDIT.md` was updated.

**Regression check:**
- every suite in §3 ran **with** the override and passed;
- the compiled CSS files have the same content-hashed names and sizes as before (`652df89eb461dd0a.css` 8,248 B; `d28440877c98e2f8.css` 99,025 B), i.e. identical output.

**Your running dev server:** it may still hold the old nested PostCSS in memory. Node's resolution falls back to the same 8.5.31, but restart `npm run dev` when convenient.

## 5. Remaining dependency advisory (accepted)

| Package | Version | Severity | Where it runs | Exposure | Fix |
|---|---|---|---|---|---|
| `deepmerge-ts` via `@prisma/config` / `prisma` | 7.1.5 / 6.19.3 | high (GHSA-ggr8-5vv4-36mx) | Prisma CLI only (`generate`, `migrate`) | Merges Prisma's own configuration; never request data | Prisma 7 (major upgrade). Accepted until 2027-01-31 in `security/audit-allowlist.json`. |

Prisma 6.19.3 is the newest 6.x, so there is no in-major fix.

**Before upgrading to Prisma 7:**
- re-run every suite in §3;
- also run `test:mysql` and the app on MySQL;
- check the generated MySQL schema.

## 6. Staging deployment checklist

New, reusable document: **`docs/STAGING-CHECKLIST.md`**. It covers:
1. a fresh MySQL database, migrations and fail-closed startup;
2. the first administrator, MFA enrolment, recovery codes and the lost-device path;
3. real SMTP: test e-mail, password reset end to end, contact form;
4. customer features, including QR and barcode scanning on real phones;
5. admin role boundaries;
6. backup and restore rehearsal (database and uploads, same point in time);
7. the Razorpay **test-mode** sequence, with live mode only after it passes.

All items are **NOT VERIFIED** until you run them on staging.

## 7. Git-history cleanup plan (awaiting your approval; nothing executed)

### Facts verified in this round (read-only)

- `prisma/dev.db.backup-20261025-121707` is **not tracked** in `HEAD`.
- It is reachable from commits `21277e0` (added) and `f63c944` (deleted).
- `git ls-remote origin` shows the following refs on GitHub, **all** containing that history:
  - `main`;
  - **12 Dependabot branches** (`dependabot/github_actions/…`, `dependabot/npm_and_yarn/…`);
  - **12 pull-request refs**: `refs/pull/1` … `refs/pull/12`, head and merge.
- No tags exist.
- The file holds 3 accounts' e-mail addresses and bcrypt password hashes (checked by row counts only; contents not displayed). No API keys or other secrets are in history (2026-10-25 scan).

### Why the extra refs matter

- Rewriting `main` alone leaves the old history on every Dependabot branch.
- `refs/pull/*` can't be deleted by repository owners; only GitHub Support can remove them.

### Procedure

1. **Backup.**
   - `git clone --mirror https://github.com/druvemedia/qrsathi.git qrsathi-pre-rewrite.git`
   - Keep this mirror offline and encrypted: it contains the file.
   - Confirm `git -C qrsathi-pre-rewrite.git log --oneline | wc -l` matches the remote.
2. **Freeze.**
   - Ask collaborators (Settings → Collaborators) to push pending work, then stop pushing.
   - Temporarily pause Dependabot by setting `open-pull-requests-limit: 0` in `.github/dependabot.yml`, or disable it in Settings.
3. **Close the 12 Dependabot PRs and delete their branches** (GitHub UI, or `git push origin --delete <branch>`). Dependabot recreates them afterwards from the cleaned history.
4. **Rewrite in a fresh clone**, never in `C:\Users\mishr\qrsathi`:
   - `pip install git-filter-repo`
   - `git clone https://github.com/druvemedia/qrsathi.git qrsathi-clean && cd qrsathi-clean`
   - `git filter-repo --path prisma/dev.db.backup-20261025-121707 --invert-paths`
   - Verify: `git log --all -- prisma/dev.db.backup-20261025-121707` prints nothing, and `git rev-list --all --objects | grep -c dev.db.backup` prints `0`.
5. **Controlled force-push.**
   - If branch protection blocks force-pushes on `main`, allow them temporarily.
   - `git remote add origin https://github.com/druvemedia/qrsathi.git`
   - `git push --force origin main`
   - Re-enable protection.
6. **GitHub Support:**
   - request removal of cached views and of the pull-request refs `refs/pull/1`–`12`, which still reference `21277e0`/`f63c944`;
   - ask them to run garbage collection.
   - Until then, the data stays reachable to anyone with repository access.
7. **Clones.**
   - Everyone deletes old clones and re-clones; a stale clone pushed back would restore the file.
   - For your working folder:
     - commit or back up your uncommitted work first;
     - clone fresh;
     - copy over `.env`, `prisma/dev.db`, `uploads/` and the uncommitted files;
     - keep the old folder until the new one is verified.
8. **Affected users.** Ask the 3 accounts whose hashes were in the file to change their passwords, and treat the hashes as exposed. No other credential needs rotating.
9. **Afterwards:** re-enable Dependabot, restore normal branch protection, and confirm CI passes on the rewritten `main`.

**Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Each step from 3 onwards changes shared state and needs your explicit go-ahead.

## 8. Razorpay

- **Still tested only against a simulation.** Keep checkout disabled in production.
- On staging, enable it only in **test** mode, and only for `docs/STAGING-CHECKLIST.md` §7.
- Live mode requires every row of §7 to PASS, followed by one small real payment that you refund.

## 9. Files changed in this round

| File | Change |
|---|---|
| `package.json` | `overrides.postcss = "$postcss"` (plus last round's `test:mail` script) |
| `package-lock.json` | Removed the nested `next/node_modules/postcss` 8.4.31 entry |
| `security/audit-allowlist.json` | Removed 4 stale PostCSS entries (1 entry remains) |
| `docs/SECURITY-AUDIT.md` | Advisory row #23 updated |
| `docs/STAGING-CHECKLIST.md` | New |
| `docs/audit/production-readiness-update-2026-10-26.md` | This report (new) |

The 25 files from the previous round are unchanged in this round. 30 paths are now uncommitted (including this report).

## 10. Waiting for your explicit approval

1. **Git history:** steps 3–9 of §7, including the force-push and the GitHub Support request; plus the password-reset request to 3 users.
2. **Licence choice:** options are in the previous report, §11.
3. **Staging:** sending real e-mails and running Razorpay **test-mode** payments.
4. **Checkout:** enabling it (test mode on staging first; live only after the checklist passes).
5. **Docker:** starting it to re-run `test:mysql` and the app on MySQL. It also hosts your other project's containers.
6. **Development database:** any change to its accounts. Production must start from an empty database either way.
7. **Commit and push:** the 30 uncommitted paths. Suggested: one commit for the remediation, one for the dependency override.
