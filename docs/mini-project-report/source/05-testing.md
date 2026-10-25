# Chapter 5: System Testing

## 5.1 Introduction

This chapter reports how QRSathi was tested for this report. A strict distinction is kept between **executed** tests — commands that were actually run during the audit, with their real output — and **proposed** tests, which are documented procedures marked "Not executed". No result in this chapter is estimated or assumed.

The repository contains its own automated suites (`scripts/test-*.mts`). The audit executed all of them; added a small number of probe checks for scenarios the suites do not assert; and recorded every command, environment detail, pass/fail count and failure explanation.

## 5.2 Testing Objectives

1. Confirm that the code compiles, type-checks and satisfies the lint rules.
2. Confirm that core logic (QR payloads, barcode validation, security utilities) behaves correctly in isolation.
3. Confirm that the HTTP API enforces authentication, authorization, validation and business rules.
4. Confirm security properties: session handling, RBAC, MFA, CSRF, rate limiting, secret handling, webhook verification.
5. Confirm database portability between SQLite and MySQL.
6. Confirm that the user interface renders without layout overflow, CSP violations or missing accessible names, and that the scanner decodes real codes.
7. Identify and record defects.

## 5.3 Testing Strategy

The strategy follows the test pyramid:

- **Static analysis** — TypeScript (`tsc --noEmit`) and ESLint.
- **Unit tests** — pure functions tested without a server (`npm test`).
- **Integration/API tests** — real HTTP requests against a production build with a throw-away database (`test:api`, `test:admin`, `test:billing`).
- **Database tests** — migrations and data migration on a real MySQL server (`test:mysql`).
- **End-to-end browser tests** — headless Chromium driven through the DevTools protocol (`test:browser`).
- **Audit probes** — short scripts written by the auditor for gaps (Section 5.16), run against the same isolated server.

Black-box techniques used by the suites include equivalence partitioning (valid/invalid inputs), boundary-value analysis (stock exactly zero, sixth login attempt, 25 visits vs a 20-scan cap, upload just over a limit) and negative/unauthorized-access testing. White-box knowledge was used to target transactions and idempotency (concurrent creates, duplicate webhooks).

## 5.4 Testing Environment

Table 5.1: Test environment

| Item | Value |
|---|---|
| Operating system | Windows 11 Pro 10.0.26200 |
| Node.js / npm | 22.22.3 / 10.9.8 |
| Code under test | Git HEAD `9b5dae7` **plus uncommitted working-tree changes** (115 entries in `git status` at the final run) |
| Build | `next build` into an isolated directory `.next-audit` (`NEXT_DIST_DIR`), production mode |
| Server | `next start -p 3100`, `NODE_ENV=production`, freshly generated random secrets, no SMTP, no real payment keys |
| Database (integration) | Throw-away SQLite file in a temporary folder (never `prisma/dev.db`) |
| Database (MySQL test) | `mysql:8.4` Docker container on 127.0.0.1:33306, removed after the run |
| Browser | Microsoft Edge (Chromium), headless, driven by `scripts/test-browser.mts` |
| Payment provider | Deterministic mock Razorpay server started by `test:billing` (no real payments) |
| Final run window | 2026-10-25 18:41:35 to 18:46:32 IST (integration suites); unit checks re-run afterwards |

**Important note on the code snapshot.** The working tree was being modified while the audit was in progress (for example `next.config.mjs` changed at 18:27:25 and `scripts/test-browser.mts` at 18:34). An earlier run therefore differed from the final run; both are reported in Section 5.16 so that the effect is transparent. All headline numbers in this chapter come from the **final run** on the tree as it stood at 18:41 IST.

## 5.5 Unit Testing

`npm test` runs three suites without a server:

- `scripts/test-security.mts` — open-redirect guard, log redaction, JSON-LD escaping, start-up configuration validation, TOTP against RFC 6238 test vectors, MFA secret encryption, recovery codes, rate limiting, IP-spoofing rules, CSRF origin rules, RBAC rules, and the MySQL schema generator. **Result: 134 passed, 0 failed.**
- `scripts/test-qr.mts` — every QR content type and design style is rendered and decoded again. **Result: "All QR checks passed"** (this suite prints no assertion count).
- `scripts/test-barcodes.mts` — check digits, invalid-input rejection, generate → render → decode with zxing-wasm for every format, label scannability, multi-code images, lookup-key normalisation and PDF export. **Result: 166 passed, 0 failed.**

## 5.6 Integration Testing

`test:api` exercises authentication and CSRF, products, barcode lookup, stock movements, isolation between users, edit/archive, import and the existing QR/UPI/dynamic features over HTTP. **Final result: 73 passed, 0 failed.**

`test:billing` starts a mock Razorpay server and tests the payment gateway configuration, re-authentication, pricing administration, server-side pricing at checkout, webhooks (signature, ledger, duplicates, mismatches), renewal, failure, halt, cancellation and refunds, price changes, server-side entitlements, branding and secret leakage. **Final result: 128 passed, 0 failed.** (First run: 126 passed, 2 failed — see D-02.)

## 5.7 System Testing

System testing exercised the complete production build through its public interfaces: HTTP APIs, public routes (`/r`, `/p`, `/f`, `/brand`) and pages, together with the start-up configuration checks. The smoke checks in `test:api` confirm that the main pages return HTTP 200, that private pages redirect guests to the login page, and that the WebAssembly decoder is served.

## 5.8 End-to-End Testing

`test:browser` drives a real browser:

1. **Camera scanning** — a generated EAN-13, Code 128, QR code and Data Matrix are fed to the page as a fake webcam video; each must be decoded and classified.
2. **Image upload** — one image containing four codes must produce four results, and a UPI QR must show a payment warning.
3. **Responsive layout** — public and workspace pages at 375, 768 and 1280 px must not scroll horizontally, must produce no CSP violations or console errors, and (at 1280 px) all controls must have accessible names.
4. **Admin console** — an administrator created with the CLI signs in through the real form; every console page is checked the same way.

**Final result: 445 passed, 7 failed.** All camera, upload, public-page and workspace-page checks passed. The seven failures are all in the admin-console section: six are heading checks that look for the text "Paid accounts" and "Payment records", which no longer exists anywhere in `src/` after the admin console was redesigned (stale test expectations, D-04), and one is a genuine horizontal overflow of `/admin/settings/pricing` at 768 px (scroll width 825 px, D-03).

## 5.9 Database Testing

- `npx prisma validate` — schema valid.
- `npm run db:mysql:schema -- --check` — the committed MySQL schema matches the canonical schema.
- `npm run test:mysql` against MySQL 8.4 — applies both MySQL migrations to a new database, migrates an edge-case SQLite database with the real migration script, and checks exact round-trips of IDs, foreign keys, millisecond timestamps, NULLs, booleans, Unicode, 1,500-character barcodes and money values; case-sensitive short codes; case-insensitive search; and that the migration refuses non-empty targets and writes nothing when pre-flight checks fail. **Result: 32 passed, 0 failed (74 s).**
- Business-level database behaviour (unique constraints, transactions, cascade rules) is exercised through the API suites (duplicate SKU/barcode → 409, concurrent quota checks, idempotent payments).

## 5.10 Authentication and Authorization Testing

`test:admin` focuses on identity and access control: public endpoint headers; sign-up never creating administrators; admin APIs denying by default; separate admin sign-in; mandatory MFA enrolment for super administrators; logout and MFA sign-in including replayed and forged codes; user management and RBAC rules; audit logging; settings validation and stored XSS; sessions, password changes and reset tokens; IDOR and uploads; webhook signature and idempotency; rate limiting; and a scan of the client bundle for secrets. **Final result: 99 passed, 0 failed.**

## 5.11 Security Testing

Security testing in this audit consisted of (a) the automated security assertions above, (b) source-code review of authentication, authorization, validation, upload handling, payment verification and secret handling (Section 4.17 and `QRSathi_Project_Audit.md`), (c) dependency checks (`npm run audit:check`: passed, with five advisories explicitly accepted until 2027-01-31) and (d) the probe scripts in Section 5.16. **No formal penetration test was performed**, and the real Google, SMTP and Razorpay integrations were not exercised.

## 5.12 Usability and Responsive Testing

Responsive behaviour was tested automatically at three widths (Section 5.8). Visual inspection of the captured screenshots (Appendix G) was performed by the auditor. No usability study with real users, no task-completion measurements and no manual screen-reader testing were performed.

## 5.13 Performance Testing

**Not executed.** No load-testing tool or production-like environment was available, and the repository contains no performance tests. The only timing data collected are incidental: the production build took 30–67 seconds and the server started in under 0.5 seconds on the audit machine. These are not performance measurements of the application under load. A proposed procedure is listed as TC-SYS-08.

## 5.14 Regression Testing

Re-running the suites after the working tree changed acted as regression testing. Two failures in the first billing run (D-02) disappeared in the final run after a configuration change made concurrently by the developer, while defect D-01 was confirmed to persist on the final build. The CI workflow (`.github/workflows/ci.yml`) is designed to run these suites on every push and pull request; CI execution on GitHub was **not** observed in this audit.

## 5.15 Compatibility Testing

Only Chromium (Edge) was tested automatically. Firefox, Safari and real mobile devices were not tested (TC-SYS-09, not executed). Database compatibility (SQLite ↔ MySQL 8.4) was tested (Section 5.9).

## 5.16 Test Cases and Test Results

Table 5.2: Commands executed and results (final run unless stated)

| # | Command | Result | Notes |
|---|---|---|---|
| 1 | `npm run typecheck` | Pass (0 errors) | 9 s |
| 2 | `npm run lint` | Pass (0 errors, 5 warnings) | warnings: unused eslint-disable directives, a missing hook dependency in `scanner.tsx`, an unused expression in `products-list.tsx`, anonymous default export in `postcss.config.mjs` |
| 3 | `npm test` | Pass: 134 + QR suite + 166 | security, QR, barcodes |
| 4 | `npx prisma validate` | Pass | — |
| 5 | `npm run db:mysql:schema -- --check` | Pass | schemas in sync |
| 6 | `npm run audit:check` | Pass | 5 advisories accepted until 2027-01-31 |
| 7 | `npm run license:check` | Pass | licence report produced |
| 8 | `next build` (isolated) | Pass | 30 s final; 67 s first build |
| 9 | `npm run test:api` | 73 passed, 0 failed | — |
| 10 | `npm run test:admin` | 99 passed, 0 failed | first attempt aborted by a broken server log pipe in the audit harness; re-run passed |
| 11 | `npm run test:billing` | 128 passed, 0 failed | first run 126/2 (D-02) |
| 12 | `npm run test:browser` | 445 passed, 7 failed | D-03, D-04; earlier runs also had environment-related connection failures |
| 13 | `npm run test:mysql` | 32 passed, 0 failed | MySQL 8.4 container |
| 14 | Audit probe: upload sizes | 5 MB ✓, 9.5 MB ✓, 12 MB ✗ (Pro plan) | D-01 |
| 15 | Audit probe: gap cases | 7 of 7 passed | TC-AUTH-03/04, TC-QR-06, TC-DYN-03, TC-UPL-04 |

In total, **745 integration and end-to-end assertions passed** in the final runs (73 + 99 + 128 + 445), plus 300 counted unit assertions (134 + 166), the uncounted QR suite and 32 MySQL assertions, against **7 failures**, all in the browser suite.

Table 5.3: Test-case summary (full detail in Appendix D)

[[TESTCASES_SUMMARY]]

## 5.17 Defect Log

Table 5.4: Defect log

| ID | Severity | Module | Description | Evidence | Status |
|---|---|---|---|---|---|
| D-01 | Medium | Uploads | Uploads larger than 10 MB fail with "No file received." even when the user's plan allows 25 MB (Pro) or 50 MB (Business). The middleware matches `/api/:path*`, and Next.js buffers at most 10 MB of a request body that passes through middleware, so the multipart body is truncated. | Probe: 12 MB PDF as Pro user → 400, on first and final builds; server log "Request body exceeded 10MB for /api/uploads" | Open |
| D-02 | Medium (security) | Headers | The sandboxing CSP set by `/f/[name]` and `/brand/[name]` was replaced by the global CSP from `next.config.mjs`, so uploaded SVG/PDF files did not get the `sandbox` directive. | test:billing first run: 2 failures | Fixed in working tree (new header rules in `next.config.mjs`); final run passed. Not yet committed |
| D-03 | Low | Admin UI | `/admin/settings/pricing` scrolls horizontally at 768 px (scroll width 825 px). | test:browser final run | Open |
| D-04 | Low (test) | Test suite | Browser test expects headings "Paid accounts" and "Payment records" that no longer exist in the redesigned admin pages. | test:browser final run (6 failures); `grep` finds the strings only in the test | Open |
| D-05 | Low | Admin API | `PATCH /api/admin/users/[id]` accepts only the plan ids `free`, `pro`, `business`, although plans are now administrator-defined in the database; custom plans cannot be assigned manually. | Source review (`z.enum(["free","pro","business"])`) | Open |
| D-06 | Low | Code quality | 5 ESLint warnings, including a missing `useEffect` dependency in the scanner. | `npm run lint` | Open |
| D-07 | High (repository) | Security | A SQLite backup with user records and bcrypt hashes is present in Git history (commit `21277e0`). | `git log --all --name-only` | Open (documented by the developer in `docs/OPEN-SOURCE-READINESS.md`) |
| D-08 | Info | Configuration | The local `.env` still defines the obsolete `ADMIN_EMAILS`, which produces a start-up warning. | Variable names in `.env`; `env-check.ts` | Open |

## 5.18 Test Coverage and Limitations

- No code-coverage tool is configured, so **line or branch coverage is unknown**. Coverage is described functionally by the requirement traceability matrix: of 22 functional requirements, 17 are verified by executed tests, 4 are partially verified and 1 (moderation, FR-19) is implemented but not independently verified.
- External integrations (Google OAuth, SMTP delivery, live Razorpay) were not tested.
- Only Chromium was tested; no real mobile devices.
- No performance, load, soak or penetration testing.
- The code under test included uncommitted changes that were still being edited; the results describe the snapshot at 18:41 IST on 2026-10-25.
- Browser runs before the final one were affected by intermittent `ERR_CONNECTION_REFUSED` errors whose cause was not determined (the final run had none); those runs are not counted.

## 5.19 Testing Summary

The project has an unusually complete automated test set for a mini project, and it was executed end-to-end in an isolated environment. All type, lint, unit, API, administration/security, billing and MySQL tests passed in the final run. The browser suite passed 445 checks, with seven admin-console failures traced to one minor layout defect and stale test expectations. Independent probes confirmed seven additional behaviours and uncovered one functional defect (D-01, large uploads on paid plans). Of the 91 documented test cases, 84 passed, 2 failed and 5 were not executed because they require external services, other browsers or a load-testing environment.
