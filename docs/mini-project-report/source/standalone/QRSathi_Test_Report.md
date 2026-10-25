# QRSathi — Test Report

**Code under test:** HEAD `9b5dae7` + uncommitted working-tree changes, snapshot of 2026-10-25 18:41 IST.
**Environment:** Windows 11 Pro 10.0.26200; Node.js 22.22.3; npm 10.9.8; Microsoft Edge (Chromium, headless) for browser tests; Docker `mysql:8.4` for the MySQL test.
**Isolation:** production build in `.next-audit` (`NEXT_DIST_DIR`), server on port 3100, freshly generated random secrets, throw-away SQLite databases in a temporary folder, uploads in a temporary folder. The developer's `prisma/dev.db`, `.env` and dev server (port 3000) were not used or modified. The MySQL container was removed after the test. No real e-mail, Google or Razorpay calls were made (billing uses the suite's mock Razorpay server).

Only results that were actually produced are reported. "Not executed" means the procedure is documented but was not run.

## 1. Commands and results

### 1.1 Static checks and unit tests (final tree)

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `npm run typecheck` | 0 | No type errors (9 s) |
| 2 | `npm run lint` | 0 | 0 errors, 5 warnings |
| 3 | `npm test` | 0 | security 134 passed / 0 failed; QR "All QR checks passed"; barcodes 166 passed / 0 failed |
| 4 | `npx prisma validate` | 0 | Schema valid |
| 5 | `npm run db:mysql:schema -- --check` | 0 | MySQL schema up to date |
| 6 | `npm run audit:check` | 0 | Pass; 5 advisories accepted until 2027-01-31 |
| 7 | `npm run license:check` | 0 | Licence report printed |

Lint warnings: `postcss.config.mjs` anonymous default export; `products-list.tsx` unused expression and unused eslint-disable; `scanner.tsx` unused eslint-disable and missing `start` dependency in a `useEffect`.

### 1.2 Integration, end-to-end and database tests

| # | Command | First run | Final run (18:41–18:47 IST) | Notes |
|---|---|---|---|---|
| 8 | `npx next build` (isolated) | Pass (67 s) | Pass (30 s) | — |
| 9 | `npm run test:api` | 73/0 | **73 passed, 0 failed** | — |
| 10 | `npm run test:admin` | aborted (ECONNRESET), re-run 99/0 | **99 passed, 0 failed** | First abort caused by the audit harness closing the server's log pipe, not by the application |
| 11 | `npm run test:billing` | 126/2 | **128 passed, 0 failed** | The 2 first-run failures were defect D-02, fixed in the working tree between runs |
| 12 | `npm run test:browser` | 293/39 and 412/40 (environment errors) | **445 passed, 7 failed** | Earlier runs had intermittent `ERR_CONNECTION_REFUSED` and a test file edited mid-audit; final run had none |
| 13 | `npm run test:mysql` | — | **32 passed, 0 failed** (74 s) | MySQL 8.4 container |

### 1.3 Audit probes (written by the auditor; run on the isolated server)

| Probe | Result |
|---|---|
| Upload 5 MB / 9.5 MB / 12 MB PDF as a **Pro** user (25 MB limit) | 201 / 201 / **400 "No file received."** → defect D-01 (reproduced on first and final builds) |
| Weak password at sign-up | 400 "password: Use at least one letter and one number" |
| Duplicate e-mail at sign-up | 409 |
| Reserved alias `admin` for dynamic QR | 400 "That alias is reserved." |
| Paused dynamic QR | 410 |
| Expired dynamic QR (2.5 s expiry) | 410 |
| Unknown short code | 404 |
| HTML file renamed `.pdf` uploaded | 415 "The file content doesn't match its extension." |

## 2. Browser-suite failures (final run)

| Check | Width(s) | Cause | Classification |
|---|---|---|---|
| `/admin/subscriptions renders "Paid accounts"` | 375, 768, 1280 | Heading text no longer exists in `src/` after redesign | Stale test expectation (D-04) |
| `/admin/payments renders "Payment records"` | 375, 768, 1280 | Same | Stale test expectation (D-04) |
| `/admin/settings/pricing fits the screen` | 768 | Scroll width 825 px > 768 px | Application layout defect (D-03) |

All camera-scanning, image-upload, public-page and workspace-page checks passed (24 public/workspace pages × 3 widths; no overflow, CSP violations or console errors; accessible names at 1280 px).

## 3. Test cases

Summary: 91 documented test cases — **84 Pass, 2 Fail, 5 Not executed**.

[[TESTCASES_TABLE]]

## 4. Defects

[[DEFECT_TABLE]]

## 5. Not executed and why

| Test | Reason |
|---|---|
| Google OAuth end-to-end (TC-AUTH-17) | No Google OAuth client configured in the audit environment |
| Live Razorpay test-mode payment (TC-BIL-06) | No Razorpay account or public webhook URL |
| Load/performance (TC-SYS-08) | No load-testing tool or production-like environment |
| Firefox/Safari/mobile devices (TC-SYS-09) | Only Chromium available |
| Database outage (TC-SYS-10) | Would require breaking the DB; not attempted |
| SMTP delivery | No SMTP server configured (the app logged `mail.not_configured`) |
| Code coverage | No coverage tool configured |

## 6. How to reproduce

See Appendix E of the report or `QRSathi_Installation_and_User_Guide.md`. Never run the integration suites against a database containing real data; they create and delete accounts.
