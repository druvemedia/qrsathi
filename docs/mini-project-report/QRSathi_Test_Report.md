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

| Test case ID | Module | Test scenario | Preconditions | Test steps | Input | Expected result | Actual result | Status | Evidence or reason | Type |
|---|---|---|---|---|---|---|---|---|---|---|
| TC-AUTH-01 | Auth | Sign-up creates an ordinary user even if a role is injected | Sign-ups enabled | POST /api/auth/signup with extra field role=super_admin | name, e-mail, valid password, role=super_admin | 201; DB role = user | 201; role stored as 'user' | Pass | test:admin: "sign-up with injected role succeeds as a normal user"; test:admin: "database row has role 'user'" | positive / security |
| TC-AUTH-02 | Auth | Sign-up response and session cookie are safe | — | Sign up; inspect response body and Set-Cookie | valid data | No hash/token fields; cookie HttpOnly, SameSite=Lax | As expected | Pass | test:admin: "sign-up response has no hash, token or secret fields"; test:admin: "workspace cookie is HttpOnly + SameSite=Lax" | security |
| TC-AUTH-03 | Auth | Duplicate e-mail rejected at sign-up | Account exists | POST /api/auth/signup with the same e-mail | existing e-mail | 409 Conflict | 409 'An account with this email already exists. Try signing in.' | Pass | Audit probe (probe-cases.mts) on the final isolated build: duplicate e-mail → 409 | negative / duplicate |
| TC-AUTH-04 | Auth | Weak password rejected | — | POST /api/auth/signup with 'abcdefgh' | 8 letters, no digit | 400 'Use at least one letter and one number' | 400 'password: Use at least one letter and one number' | Pass | Audit probe (probe-cases.mts) on the final isolated build: weak password → 400 | negative / boundary |
| TC-AUTH-05 | Auth | Private API requires sign-in | No session | GET/POST /api/products, /lookup, /inventory, /overview, /import | no cookie | 401 for each | 401 for each | Pass | test:api: "GET /api/products requires sign-in (401)" (+5 similar) | unauthorized |
| TC-AUTH-06 | Auth | Cross-site state-changing request blocked | Signed in | POST with Origin of another site | Origin: https://evil.example | 403 | 403 | Pass | test:api: "cross-site POST blocked (403)" | security / CSRF |
| TC-AUTH-07 | Auth | Generic error for wrong password, unknown e-mail and non-admin | Accounts exist | POST /api/admin/auth/login three ways | wrong pw; unknown e-mail; ordinary user | Identical 401 message | Identical | Pass | test:admin: "same generic error for non-admin, wrong password and unknown e-mail" | negative / enumeration |
| TC-AUTH-08 | Auth | Session fixation prevented | Signed in | Sign in again in same browser | — | New session id; old revoked | As expected | Pass | test:admin: "re-login issues a new session id (fixation)"; test:admin: "the replaced session is revoked" | security |
| TC-AUTH-09 | Auth | Logout invalidates token server-side | Signed in | POST /api/auth/logout; reuse old cookie | old cookie | 401 | 401 | Pass | test:admin: "user logout invalidates the token server-side" | expired / revoked session |
| TC-AUTH-10 | Auth | Suspended user cannot sign in; sessions end immediately | Admin suspends user | Use old cookie; then sign in | valid credentials | 401 on old session; 403 on login | As expected | Pass | test:admin: "suspension ends the user's sessions immediately"; test:admin: "suspended user cannot sign in" | role restriction |
| TC-AUTH-11 | Auth | Forgot-password does not reveal accounts | — | POST /api/auth/forgot for existing and unknown e-mail | two e-mails | Identical responses | Identical | Pass | test:admin: "forgot-password: identical response for existing and unknown e-mail" | security |
| TC-AUTH-12 | Auth | Reset token works once and is stored hashed | Token issued | POST /api/auth/reset twice | valid token, new password | 1st 200; 2nd 400; DB holds only hash | As expected | Pass | test:admin: "reset token is single-use"; test:admin: "token is stored only as a hash" | positive / negative |
| TC-AUTH-13 | Auth | Expired reset token rejected | Token past expiresAt | POST /api/auth/reset | expired token | 400 | 400 | Pass | test:admin: "expired token rejected" | boundary / expired |
| TC-AUTH-14 | Auth | Reset signs out existing sessions | Two sessions | Reset password; reuse other session | — | Other session 401 | As expected | Pass | test:admin: "reset signs out existing sessions" | security |
| TC-AUTH-15 | Account | Password change signs out other devices but keeps current | Two sessions | PATCH /api/account with current + new password | valid passwords | Other session 401; current works | As expected | Pass | test:admin: "password change signs out other sessions"; test:admin: "…but keeps the current browser signed in" | positive |
| TC-AUTH-16 | Auth | Brute-force limit on admin sign-in | — | 6 failed admin sign-ins for one account | wrong password ×6 | 6th → 429 | 429 | Pass | test:admin: "6th admin sign-in attempt for one account → 429" | boundary / abuse |
| TC-AUTH-17 | Auth | Google sign-in (OAuth) end-to-end | Google client configured | Click 'Continue with Google', consent, return | Google account | Account created/linked; session | Not run (no Google credentials in audit) | Not executed | Requires live Google OAuth client | integration |
| TC-QR-01 | QR | Every QR type and style renders and decodes | — | npm run test:qr renders each type/style and decodes with a scanner | type defaults | Decoded text equals payload | 'All QR checks passed' | Pass | test:qr (npm test) output: All QR checks passed | positive |
| TC-QR-02 | QR | Generator page loads | Server running | GET /generator | — | 200 | 200 | Pass | test:api: "GET /generator → 200" | smoke |
| TC-QR-03 | QR | Generator page fits mobile/tablet/desktop with no CSP errors | Browser | Load /generator at 375/768/1280 px | — | No overflow, no CSP violation | As expected | Pass | test:browser: "375px /generator fits the screen" (+ 768/1280, CSP) | usability |
| TC-QR-04 | QR | User B cannot read or delete A's QR code | Two users | GET/DELETE /api/qrcodes/{A's id} as B | — | 404 | 404 | Pass | test:admin: "user B can't read A's QR code (404)"; test:admin: "user B can't delete A's QR code" | unauthorized / IDOR |
| TC-QR-05 | QR | Dynamic-QR quota enforced under concurrency | Free plan (5 dynamic) | Concurrent POST /api/qrcodes dynamic=true beyond the limit | valid dynamic QRs | At most 5 created; clear 403 | As expected | Pass | test:billing: "concurrent creates can't exceed the Free dynamic limit (5)"; test:billing: "over-limit request gets a clear 403" | boundary / concurrency |
| TC-QR-06 | QR | Custom alias collision / reserved word | Pro plan | POST /api/qrcodes alias='admin' | alias=admin | 400 reserved | 400 'That alias is reserved. Try another.' | Pass | Audit probe (probe-cases.mts) on the final isolated build: reserved alias 'admin' → 400 | negative |
| TC-QR-07 | UPI | UPI QR saved with correct URI | Signed in | POST /api/qrcodes type=upi | valid VPA, amount | upi://pay?… payload | As expected | Pass | test:api: "UPI QR saved with correct URI" | positive |
| TC-QR-08 | UPI | Invalid UPI ID rejected | Signed in | POST /api/qrcodes type=upi | pa='not-a-vpa' | 400 | 400 | Pass | test:api: "invalid UPI ID rejected" | negative |
| TC-DYN-01 | Dynamic QR | Dynamic QR created | Signed in | POST /api/qrcodes dynamic=true | https URL | 201 with /r/{code} payload | 201 | Pass | test:api: "dynamic QR created" | positive |
| TC-DYN-02 | Dynamic QR | Dynamic QR redirects | Code exists | GET /r/{code} | — | 302 to destination | 302 | Pass | test:api: "dynamic QR redirects (302)" | positive |
| TC-DYN-03 | Dynamic QR | Paused / expired code shows 410 page | Code paused or expired | GET /r/{code} | — | 410 explanatory page | Paused → 410; expired (2.5 s expiry) → 410; unknown code → 404 | Pass | Audit probe (probe-cases.mts) on the final isolated build: paused 410, expired 410, unknown 404 | negative / boundary |
| TC-DYN-04 | Analytics | Scan recording capped per client | Code exists | 25 visits from one client | — | All redirected; 20 scans stored | As expected | Pass | test:admin: "scan recording capped per client (25 visits → 20 scans; every visitor still redirected)" | boundary / abuse |
| TC-BC-01 | Barcodes | All 23 formats render and decode with the app's scanner | — | npm run test:barcodes | format examples | Decoded value matches | 166 assertions passed | Pass | test:barcodes (npm test): 166 passed, 0 failed | positive |
| TC-BC-02 | Barcodes | Wrong EAN-13 check digit rejected | Signed in | POST /api/products with bad EAN-13 | EAN-13 with wrong check digit | 400 | 400 | Pass | test:api: "wrong EAN-13 check digit rejected (400)" | negative |
| TC-BC-03 | Barcodes | Internal GTIN outside restricted range rejected | Signed in | POST /api/products source=internal | EAN-13 starting 89… | 400 | 400 | Pass | test:api: "'internal' barcode outside restricted range rejected (400)" | negative / business rule |
| TC-BC-04 | Barcodes | Internal EAN-13 generated in restricted range | Signed in | GET /api/products/next-code?format=ean13 | — | Starts with 2 | As expected | Pass | test:api: "internal EAN-13 is generated in restricted range (starts with 2)" | positive |
| TC-SCN-01 | Scanner | Camera scan of EAN-13, Code 128, QR and Data Matrix | Chromium with fake webcam | Open /scanner?camera=1 with Y4M video | 4 generated codes | Each decoded and classified | All 4 decoded | Pass | test:browser: "camera → ean13 "8901234567890" shown as Product barcode" (+3) | positive |
| TC-SCN-02 | Scanner | Image with several codes decoded | Chromium | Upload one image with 4 codes | PNG | '4 codes detected' | As expected | Pass | test:browser: "upload → "4 codes detected"" | positive |
| TC-SCN-03 | Scanner | UPI QR shows payment warning | Chromium | Upload UPI QR image | upi://pay… | Warning text, not a payment | As expected | Pass | test:browser: "UPI QR from upload shows payment warning, not a payment" | security / usability |
| TC-PRD-01 | Products | Create product with barcodes; price in paise | Signed in | POST /api/products | name, SKU, price 149.00, 2 barcodes | 201; priceMinor 14900; EAN-13 primary | As expected | Pass | test:api: "create product (201)"; test:api: "price stored in paise" | positive |
| TC-PRD-02 | Products | Duplicate SKU rejected | Product exists | POST same SKU | duplicate SKU | 409 | 409 | Pass | test:api: "duplicate SKU rejected (409)" | duplicate |
| TC-PRD-03 | Products | Duplicate barcode rejected (incl. UPC-A/EAN-13 equivalence) | Product exists | POST same barcode / EAN-13 form of a UPC-A | barcode | 409 | 409 | Pass | test:api: "EAN-13 equivalent of an existing UPC-A rejected as duplicate (409)" | duplicate |
| TC-PRD-04 | Products | Missing name / invalid price rejected | Signed in | POST /api/products | name=''; price='abc' | 400 | 400 | Pass | test:api: "missing name rejected (400)"; test:api: "invalid price rejected (400)" | negative |
| TC-PRD-05 | Products | Other user cannot read, edit or move stock | Users A and B | B calls A's product endpoints | — | 404 | 404 | Pass | test:api: "user B cannot read A's product (404)" (+edit, stock) | unauthorized / IDOR |
| TC-PRD-06 | Products | Same SKU allowed for a different user | Users A and B | B creates product with A's SKU | same SKU | 201 | 201 | Pass | test:api: "same SKU/barcode allowed for a different user" | positive / tenancy |
| TC-PRD-07 | Products | Partial edit keeps untouched fields | Product exists | PATCH price & category only | partial body | Other fields unchanged | As expected | Pass | test:api: "partial edit keeps untouched fields and barcodes" | positive |
| TC-PRD-08 | Products | Delete requires archive first | Active product | DELETE then archive then DELETE | — | 400, then 200 | As expected | Pass | test:api: "deleting an active product is refused (400)"; test:api: "delete archived product" | business rule |
| TC-PRD-09 | Products | Barcode lookup is read-only and finds equivalents | Products exist | GET /api/products/lookup?code=… | EAN-13 / UPC-A / SKU / unknown | Found / found:false; stock unchanged | As expected | Pass | test:api: "scanned EAN-13 form finds UPC-A product"; test:api: "lookups did not change stock" | positive |
| TC-PRD-10 | Import | CSV/XLSX import with per-row report | Signed in | POST /api/products/import mode=skip | rows incl. invalid | created/skipped/error statuses | As expected | Pass | test:api: "import report statuses"; test:api: "import summary" | positive / negative |
| TC-PRD-11 | Import | Import update mode logs stock as adjustment | SKU exists | POST import mode=update | changed name, stock | Updated; ledger 'adjust' | As expected | Pass | test:api: "import stock change recorded as adjustment" | positive |
| TC-INV-01 | Inventory | Stock in increases stock | Stock 10 | POST stock type=in qty=5 | 5 | 15 | 15 | Pass | test:api: "stock in +5 → 15" | positive |
| TC-INV-02 | Inventory | Stock out decreases stock | Stock 15 | POST type=out qty=3 | 3 | 12 | 12 | Pass | test:api: "stock out −3 → 12" | positive |
| TC-INV-03 | Inventory | Stock out beyond available rejected | Stock 12 | POST type=out qty=999 | 999 | 400; stock unchanged | 400 | Pass | test:api: "stock out beyond available rejected (400)" | boundary |
| TC-INV-04 | Inventory | Zero quantity rejected; adjust sets value and flags low stock | Product | POST qty=0; POST adjust=2 | 0; 2 | 400; stock 2, lowStock true | As expected | Pass | test:api: "zero quantity rejected (400)"; test:api: "adjust (stock-take) sets 2, low-stock flagged" | boundary |
| TC-INV-05 | Inventory | History records every movement with balances; archived blocks movement | Movements made | GET history; archive; POST stock | — | Ledger complete; 400 when archived | As expected | Pass | test:api: "activity history records every movement with balances"; test:api: "archived product: stock changes refused (400)" | positive / negative |
| TC-UPL-01 | Uploads | Oversized upload rejected before parsing (Free plan) | Free plan (10 MB) | POST /api/uploads > limit | >10 MB body | 413 | 413 | Pass | test:admin: "oversized upload rejected before parsing (413)" | boundary |
| TC-UPL-02 | Uploads | Paid-plan upload between 10 MB and plan limit | Pro plan (25 MB) | POST /api/uploads with 5, 9.5 and 12 MB PDFs (audit probe) | valid %PDF- files | 201 for all three | 201, 201, then 400 'No file received.' for 12 MB | Fail | Audit probe scripts/probe-upload (logs/probe-upload.log); defect D-01 | boundary / defect |
| TC-UPL-03 | Uploads | Uploaded files served with sandboxing CSP | File exists | GET /f/{name}; check CSP | — | CSP contains 'sandbox' | First build: global CSP (fail); final tree: sandbox present | Pass | test:billing: "user uploads (/f) are also served with a sandboxing CSP" — failed in run 1, passed in final run (D-02 fixed in working tree) | security / regression |
| TC-UPL-04 | Uploads | File whose content does not match its extension | Signed in | Upload an HTML file renamed .pdf | text/html bytes | 415 | 415 'The file content doesn't match its extension.' | Pass | Audit probe (probe-cases.mts) on the final isolated build: HTML renamed .pdf → 415 | negative |
| TC-BIL-01 | Billing | Forged webhook signature rejected | Webhook secret set | POST /api/billing/webhook with bad signature | payload + wrong HMAC | 400 | 400 | Pass | test:admin: "forged signature rejected (400)" | security / signature |
| TC-BIL-02 | Billing | Underpaid payment does not upgrade | Payment link | Signed webhook with lower amount | amount 100 vs 29900 | Plan unchanged | As expected | Pass | test:admin: "underpaid link does not upgrade" | negative |
| TC-BIL-03 | Billing | Duplicate webhook deliveries applied once | Valid event | Send same event concurrently | duplicate eventId | Plan extended once | As expected | Pass | test:admin: "concurrent duplicate deliveries extend the plan only once (~30 days)" | idempotency |
| TC-BIL-04 | Billing | Subscription checkout lifecycle against mock Razorpay | Mock server, sealed creds | npm run test:billing | plans, subscriptions, payments, refunds | All assertions | 128 passed, 0 failed | Pass | test:billing final run (mock Razorpay; no real payments) | integration (mock) |
| TC-BIL-05 | Entitlements | Plan features enforced on server (alias, analytics, export) | Free plan | Use custom alias; open analytics; export analytics | — | 403 for each | 403 for each | Pass | test:billing: "custom alias blocked on Free (403)"; test:billing: "analytics export disabled by plan → 403" | role / plan restriction |
| TC-BIL-06 | Billing | Live Razorpay payment in test mode | Real Razorpay test keys | Subscribe and pay with test card/UPI | — | Plan active after webhook | Not run (no Razorpay account in audit) | Not executed | Requires real Razorpay test account and public webhook URL | integration |
| TC-ADM-01 | Admin | All admin APIs deny without admin session | — | Call 13 admin GET endpoints and mutations | no cookie / user cookie | 401 | 401 | Pass | test:admin: "all 13 admin GET endpoints → 401 without a session"; test:admin: "a workspace (user) session is rejected by every admin endpoint" | unauthorized |
| TC-ADM-02 | Admin | User token replayed as admin cookie rejected | User session | Send qs_session value as qs_admin | — | 401 | 401 | Pass | test:admin: "user token replayed as the admin cookie is rejected" | security |
| TC-ADM-03 | Admin | Admin cookie flags | Admin login | Inspect Set-Cookie | — | HttpOnly, SameSite=Strict, ≤12 h | As expected | Pass | test:admin: "admin cookie is HttpOnly + SameSite=Strict, 12 h max" | security |
| TC-ADM-04 | Admin | Super admin forced to enrol MFA | Super admin without MFA | Sign in; call admin API; open console page | — | 403 / redirect to /admin/mfa | As expected | Pass | test:admin: "super admin without MFA: admin APIs → 403" | role restriction |
| TC-ADM-05 | Admin | MFA enrolment stores encrypted secret and hashed recovery codes | Admin | setup → enable with valid TOTP | TOTP | 10 recovery codes once; secret encrypted | As expected | Pass | test:admin: "secret stored encrypted (not plaintext)"; test:admin: "recovery codes stored only as hashes" | security |
| TC-ADM-06 | Admin | Wrong, replayed or forged MFA input rejected | MFA enabled | Submit wrong TOTP, reused TOTP, forged ticket | — | 401 | 401 | Pass | test:admin: "replayed TOTP (already used to enable) rejected"; test:admin: "forged ticket rejected" | negative |
| TC-ADM-07 | Admin | Recovery code single use | MFA enabled | Sign in with recovery code twice | code | 1st OK, 2nd 401 | As expected | Pass | test:admin: "used recovery code can't be reused" | boundary |
| TC-ADM-08 | Admin | Admin CLI refuses weak or command-line passwords | — | npm run admin create | short pw; --password arg | Refused | Refused | Pass | test:admin: "CLI refuses a weak administrator password" | negative |
| TC-ADM-09 | Admin | Admin cannot change roles, touch super admin or delete | Admin session | PATCH role; PATCH super admin; DELETE user | — | 403 | 403 | Pass | test:admin: "admin cannot change roles (403)" (+2) | role restriction |
| TC-ADM-10 | Admin | Admin changes ordinary user's plan; unknown fields ignored | Admin | PATCH plan | plan=pro, extra fields | 200; extras ignored | As expected | Pass | test:admin: "admin can change an ordinary user's plan" | positive |
| TC-ADM-11 | Admin | Super admin promotes/demotes; cannot change own role | Super admin | PATCH role on self and others | — | Self 400; others 200, audited | As expected | Pass | test:admin: "super admin cannot change own role"; test:admin: "super admin can promote (role change audited)" | role restriction |
| TC-ADM-12 | Admin | Bulk action skips own account | Admin | POST /api/admin/users/bulk incl. self | ids | Self skipped | As expected | Pass | test:admin: "bulk action skips the actor's own account" | business rule |
| TC-ADM-13 | Admin | Admin triggers reset e-mail without seeing token | Admin | POST action=send_password_reset | — | 200; no token in response | As expected | Pass | test:admin: "admin can trigger a reset e-mail (never sees the token)" | security |
| TC-ADM-14 | Admin | User search returns no secrets; pagination | Admin | GET /api/admin/users?q= | query | No hashes/secrets | As expected | Pass | test:admin: "user search works and returns no secrets" | security |
| TC-ADM-15 | Settings | Settings validation rejects invalid e-mail/colour | Admin | PUT /api/admin/settings | bad e-mail, bad colour | 400 | 400 | Pass | test:admin: "invalid support e-mail rejected"; test:admin: "invalid brand colour rejected" | negative |
| TC-ADM-16 | Settings | Stored XSS via brand name / announcement rejected | Admin | PUT with markup | <script>… | 400; JSON-LD safe | As expected | Pass | test:admin: "markup in the brand name rejected"; test:admin: "site name can't break out of the JSON-LD script" | security / XSS |
| TC-ADM-17 | Branding | Branding publish, assets and SVG sandboxing | Super admin | Upload assets, publish, fetch /brand/{name} | SVG/PNG | Published; SVG sandboxed + nosniff | First build failed sandbox check; final run passed | Pass | test:billing: "SVG asset served sandboxed with nosniff" (final run) | security |
| TC-ADM-18 | Audit | Audit log records admin actions without secrets | Actions performed | Inspect AuditLog rows | — | Entries present; no passwords/codes | As expected | Pass | test:admin: "audit records contain no passwords, codes or secrets" | security |
| TC-ADM-19 | Admin UI | Admin sign-in through real form and console pages render | Chromium; admin created by CLI | Sign in at /admin/login; visit each admin console page at 3 widths | — | All pages render expected headings, fit screen | 445 browser assertions passed; 6 heading checks failed (stale expectations 'Paid accounts', 'Payment records'); 1 overflow at 768 px on /admin/settings/pricing | Fail | test:browser final run: 445 passed, 7 failed; defects D-03, D-04 | usability / regression |
| TC-SYS-01 | Platform | Health endpoint reveals only status | Server running | GET /api/health | — | {status:'ok'} only | As expected | Pass | test:admin: "health returns only {status:'ok'}" | security |
| TC-SYS-02 | Platform | Security headers present; no X-Powered-By | Server running | Inspect response headers | — | CSP, nosniff, frame, referrer; no X-Powered-By | As expected | Pass | test:admin: "CSP set (object-src none, frame-ancestors, only Razorpay Checkout as remote script)"; test:admin: "no X-Powered-By" | security |
| TC-SYS-03 | Platform | No secrets in client bundle | Production build | Scan .next-audit/static files | 208 files | No secret values or names | As expected | Pass | test:admin: "no server secrets or secret env names in 208 client files" | security |
| TC-SYS-04 | Platform | Unsafe production configuration refused | — | Unit tests of checkEnv() | short secret, http URL, DEMO_MODE… | Errors reported | As expected | Pass | test:security (npm test): 134 passed, 0 failed | security |
| TC-SYS-05 | Database | MySQL migrations and SQLite→MySQL data migration | MySQL 8.4 container | npm run test:mysql | edge-case SQLite source | Exact round-trip; failures write nothing | 32 passed, 0 failed | Pass | test:mysql run against mysql:8.4 (Docker), 74 s | database |
| TC-SYS-06 | Database | MySQL schema in sync with canonical schema | — | npm run db:mysql:schema -- --check | — | Up to date | Up to date | Pass | unit-db_mysql_schema log | database |
| TC-SYS-07 | Responsive | Public and workspace pages fit 375/768/1280 px without CSP or console errors | Chromium | test:browser responsive section | 24 public and workspace pages × 3 widths | No overflow / CSP / console errors; accessible names | All public & workspace checks passed | Pass | test:browser final run | usability / accessibility |
| TC-SYS-08 | Performance | Redirect latency and page load under load | Production-like server | Load test /r/{code} (e.g. k6, 50 VUs, 5 min) | — | p95 < 200 ms (target) | Not run | Not executed | No load-testing tool or environment in the audit | performance |
| TC-SYS-09 | Compatibility | Firefox and Safari | Browsers installed | Manual walkthrough of main flows | — | Same behaviour as Chromium | Not run | Not executed | Only Chromium automated | compatibility |
| TC-SYS-10 | Database | Database unavailable | Stop DB | GET /api/health | — | 503 'degraded' | Not run | Not executed | checkDatabase() in src/lib/system-status.ts | negative / database error |

## 4. Defects

| ID | Severity | Module | Description | Evidence | Impact | Recommended remediation | Status |
|---|---|---|---|---|---|---|---|
| D-01 | Medium | Uploads | Uploads larger than 10 MB fail with 'No file received.' although Pro (25 MB) and Business (50 MB) plans allow them. | Audit probe on first and final builds: 5 MB 201, 9.5 MB 201, 12 MB 400; server log 'Request body exceeded 10MB for /api/uploads'. | Paid users cannot use their advertised upload limit. | Exclude /api/uploads from the middleware matcher (it needs only the origin check, which can be done in the handler), or configure the middleware body-size limit; add a regression test. | Open |
| D-02 | Medium | Security headers | Global CSP from next.config.mjs replaced the sandboxing CSP of /f/* and /brand/*. | test:billing first run: 2 failures; curl showed the global CSP on /f. | Uploaded SVG/PDF opened directly would not be sandboxed. | Path-specific header rules after the global rule (already present in the working tree). | Fixed in working tree (uncommitted); verified in final run |
| D-03 | Low | Admin UI | /admin/settings/pricing overflows horizontally at 768 px (scroll width 825 px). | test:browser final run. | Minor layout issue on tablets. | Make the pricing editor grid responsive (wrap or scroll inside a container). | Open |
| D-04 | Low | Tests | Browser test expects 'Paid accounts' and 'Payment records' headings that no longer exist. | test:browser final run (6 failures); strings absent from src/. | False failures hide real regressions. | Update expectations in scripts/test-browser.mts. | Open |
| D-05 | Low | Admin API | PATCH /api/admin/users/[id] accepts only plan ids free/pro/business although plans are admin-defined. | Source: z.enum(["free","pro","business"]). | Custom plans cannot be assigned manually. | Validate the plan id against the PricingPlan table. | Open |
| D-06 | Low | Code quality | 5 ESLint warnings (missing hook dependency in scanner, unused directives, unused expression, anonymous default export). | npm run lint. | Possible stale-closure bug in scanner effect. | Resolve warnings; treat warnings as errors in CI. | Open |
| D-07 | High | Repository | SQLite backup with user records and bcrypt hashes in Git history (commit 21277e0). | git log --all --name-only; docs/OPEN-SOURCE-READINESS.md. | Personal data exposure if the repository is public. | Rewrite history (git filter-repo) with owner approval, rotate affected passwords, delete demo admin. | Open |
| D-08 | Info | Configuration | Local .env defines obsolete ADMIN_EMAILS. | Variable names in .env; env-check warning. | Start-up warning only. | Remove the variable. | Open |

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
