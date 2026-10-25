# QRSathi — API Documentation

Generated from the route handlers in `src/app/**/route.ts` (methods and guards extracted automatically; purposes written after reading each handler). This is an internal API used by the web UI; there is no public API key mechanism.

## 1. Conventions

- **Base URL:** the application origin (`NEXT_PUBLIC_APP_URL`).
- **Format:** JSON request and response bodies (`Content-Type: application/json`), except multipart uploads, CSV export, the raw webhook body and the public HTML/redirect routes.
- **Authentication:**
  - Workspace: `qs_session` cookie (HttpOnly, SameSite=Lax, 30 days) set by sign-up/sign-in.
  - Admin console: `qs_admin` cookie (HttpOnly, SameSite=Strict, 12 h, 2 h idle) set only by `/api/admin/auth/*`. A workspace cookie never authorises admin routes.
- **CSRF:** every non-GET/HEAD/OPTIONS request under `/api` must carry an `Origin` header equal to the application origin (403 otherwise). Exception: `/api/billing/webhook` (HMAC-signed).
- **Errors:** `{ "error": "<message>", "details"?: … }` with status 400, 401, 403, 404, 409, 410, 413, 415, 429, 500, 502 or 503. Unexpected errors return a generic message; details are logged server-side with redaction.
- **Caching:** API responses send `Cache-Control: no-store`.
- **Rate limits:** fixed windows, e.g. sign-in 20/15 min per IP and 8/15 min per account (admin: 10 and 5), sign-up 10/h per IP, QR create 300/h per user, uploads 30/h per user, reports 10/h per IP.
- **Ownership:** another user's resource returns 404.

## 2. Endpoint inventory

Guard legend: *user* = `requireUser()`; *admin* / *super admin* = `requireAdmin()`; *recent re-auth* = password (+TOTP) within 15 min; *plan feature* = `requireFeature()`; *public* = no session.

| # | Route | Methods | Guard | Purpose | Source |
|---|---|---|---|---|---|
| 1 | `/api/account` | GET, PATCH, DELETE | user, rate-limited | GET own profile; PATCH name/password (current password required; other sessions revoked); DELETE account (type e-mail to confirm) | `src/app/api/account/route.ts` |
| 2 | `/api/account/sessions` | POST | user | POST sign out all other devices | `src/app/api/account/sessions/route.ts` |
| 3 | `/api/admin/analytics` | GET | admin | Platform analytics (admin) | `src/app/api/admin/analytics/route.ts` |
| 4 | `/api/admin/auth/login` | POST | rate-limited | Admin sign-in step 1 (password); returns MFA ticket when MFA enabled | `src/app/api/admin/auth/login/route.ts` |
| 5 | `/api/admin/auth/logout` | POST | admin session (checked in handler) | End admin-console session | `src/app/api/admin/auth/logout/route.ts` |
| 6 | `/api/admin/auth/me` | GET | admin session (checked in handler) | Current administrator | `src/app/api/admin/auth/me/route.ts` |
| 7 | `/api/admin/auth/mfa` | POST | rate-limited | Admin sign-in step 2 (TOTP or recovery code) | `src/app/api/admin/auth/mfa/route.ts` |
| 8 | `/api/admin/auth/reauth` | POST | admin session (checked in handler), rate-limited | Re-confirm password (+TOTP) for sensitive actions | `src/app/api/admin/auth/reauth/route.ts` |
| 9 | `/api/admin/branding` | GET, PUT, POST | admin, rate-limited | GET branding state; PUT draft; POST publish / discard / reset | `src/app/api/admin/branding/route.ts` |
| 10 | `/api/admin/branding/assets` | POST | admin, rate-limited | Upload logo/favicon/social image (validated) | `src/app/api/admin/branding/assets/route.ts` |
| 11 | `/api/admin/catalog` | GET | admin | Products and barcodes overview (admin) | `src/app/api/admin/catalog/route.ts` |
| 12 | `/api/admin/email` | GET, POST | admin, rate-limited | GET SMTP status (no credentials); POST test mail to own address | `src/app/api/admin/email/route.ts` |
| 13 | `/api/admin/logs` | GET | admin | System log entries | `src/app/api/admin/logs/route.ts` |
| 14 | `/api/admin/mfa` | GET, POST | admin (MFA not required), rate-limited | GET MFA status; POST setup / enable / disable / regenerate recovery codes | `src/app/api/admin/mfa/route.ts` |
| 15 | `/api/admin/payments` | GET | admin | Payment records | `src/app/api/admin/payments/route.ts` |
| 16 | `/api/admin/payments/config` | GET, PUT, PATCH, POST | admin, super admin, recent re-auth (super admin), rate-limited | GET gateway status (never secrets); PUT credentials (super admin + re-auth); PATCH enable/mode; POST verify | `src/app/api/admin/payments/config/route.ts` |
| 17 | `/api/admin/plans` | GET, POST | admin, super admin, rate-limited | GET plans; POST create plan (super admin) | `src/app/api/admin/plans/route.ts` |
| 18 | `/api/admin/plans/[id]` | PATCH, POST | super admin, rate-limited | PATCH edit plan (confirm if live subscribers); POST action: duplicate, publish, unpublish, archive, restore or sync provider plans | `src/app/api/admin/plans/[id]/route.ts` |
| 19 | `/api/admin/plans/reorder` | POST | super admin | Reorder plans (super admin) | `src/app/api/admin/plans/reorder/route.ts` |
| 20 | `/api/admin/qrcodes` | GET | admin | List dynamic and hosted QR codes | `src/app/api/admin/qrcodes/route.ts` |
| 21 | `/api/admin/qrcodes/[id]` | PATCH, DELETE | admin | PATCH status active/paused/disabled; DELETE QR code | `src/app/api/admin/qrcodes/[id]/route.ts` |
| 22 | `/api/admin/reports` | GET | admin | List abuse reports | `src/app/api/admin/reports/route.ts` |
| 23 | `/api/admin/reports/[id]` | PATCH | admin | PATCH report status: open, resolved or dismissed (audited) | `src/app/api/admin/reports/[id]/route.ts` |
| 24 | `/api/admin/security` | GET | admin | Audit log and security events | `src/app/api/admin/security/route.ts` |
| 25 | `/api/admin/settings` | GET, PUT | admin, rate-limited | GET/PUT general settings | `src/app/api/admin/settings/route.ts` |
| 26 | `/api/admin/stats` | GET | admin | Overview statistics | `src/app/api/admin/stats/route.ts` |
| 27 | `/api/admin/subscriptions` | GET | admin | List subscriptions | `src/app/api/admin/subscriptions/route.ts` |
| 28 | `/api/admin/subscriptions/[id]` | POST | super admin, rate-limited | Cancel a subscription (super admin) | `src/app/api/admin/subscriptions/[id]/route.ts` |
| 29 | `/api/admin/system` | GET | admin | Configuration and health status | `src/app/api/admin/system/route.ts` |
| 30 | `/api/admin/users` | GET | admin | Search and page users (no secrets) | `src/app/api/admin/users/route.ts` |
| 31 | `/api/admin/users/[id]` | PATCH, POST, DELETE | admin, super admin | PATCH role/plan/status; POST revoke sessions / send reset; DELETE account (super admin) | `src/app/api/admin/users/[id]/route.ts` |
| 32 | `/api/admin/users/bulk` | POST | admin | Bulk suspend / reactivate / revoke sessions (≤100 ids) | `src/app/api/admin/users/bulk/route.ts` |
| 33 | `/api/analytics` | GET | user | Scan statistics limited to plan's analyticsDays | `src/app/api/analytics/route.ts` |
| 34 | `/api/analytics/export` | GET | user, plan feature | CSV export of scans (requires analyticsExport feature) | `src/app/api/analytics/export/route.ts` |
| 35 | `/api/auth/forgot` | POST | rate-limited | Request password-reset e-mail (same response for any e-mail) | `src/app/api/auth/forgot/route.ts` |
| 36 | `/api/auth/google` | GET | public | Start Google OAuth flow | `src/app/api/auth/google/route.ts` |
| 37 | `/api/auth/google/callback` | GET | public | Google OAuth callback (state check, verified e-mail) | `src/app/api/auth/google/callback/route.ts` |
| 38 | `/api/auth/login` | POST | rate-limited | Workspace sign-in | `src/app/api/auth/login/route.ts` |
| 39 | `/api/auth/logout` | POST | public | Workspace sign-out | `src/app/api/auth/logout/route.ts` |
| 40 | `/api/auth/me` | GET | optional user | Current user (or null) | `src/app/api/auth/me/route.ts` |
| 41 | `/api/auth/reset` | POST | rate-limited | Set new password with a reset token | `src/app/api/auth/reset/route.ts` |
| 42 | `/api/auth/signup` | POST | rate-limited | Create account (role always 'user') | `src/app/api/auth/signup/route.ts` |
| 43 | `/api/billing` | GET | user | Own billing overview and payment history | `src/app/api/billing/route.ts` |
| 44 | `/api/billing/cancel` | POST | user, rate-limited | Cancel own subscription (at period end by default) | `src/app/api/billing/cancel/route.ts` |
| 45 | `/api/billing/status` | GET | user | Status of a subscription after checkout | `src/app/api/billing/status/route.ts` |
| 46 | `/api/billing/subscribe` | POST | user, rate-limited | Start subscription checkout (planId + interval only) | `src/app/api/billing/subscribe/route.ts` |
| 47 | `/api/billing/verify` | POST | user, rate-limited | Verify Checkout signature and confirm payment | `src/app/api/billing/verify/route.ts` |
| 48 | `/api/billing/webhook` | POST | HMAC signature | Razorpay webhook (HMAC over raw body; CSRF-exempt) | `src/app/api/billing/webhook/route.ts` |
| 49 | `/api/downloads` | GET, POST, DELETE | user | Record / list / clear download history | `src/app/api/downloads/route.ts` |
| 50 | `/api/health` | GET | public | Liveness/readiness: {status: ok\|degraded} | `src/app/api/health/route.ts` |
| 51 | `/api/inventory` | GET | user | Inventory summary and low-stock list | `src/app/api/inventory/route.ts` |
| 52 | `/api/overview` | GET | user | Dashboard counts (real data) | `src/app/api/overview/route.ts` |
| 53 | `/api/products` | GET, POST | user | GET list/search/filter; POST create product | `src/app/api/products/route.ts` |
| 54 | `/api/products/[id]` | GET, PATCH, DELETE | user | GET / PATCH / DELETE product (delete only when archived) | `src/app/api/products/[id]/route.ts` |
| 55 | `/api/products/[id]/history` | GET | user | Inventory ledger of a product | `src/app/api/products/[id]/history/route.ts` |
| 56 | `/api/products/[id]/stock` | POST | user | POST stock in / out / adjust | `src/app/api/products/[id]/stock/route.ts` |
| 57 | `/api/products/import` | POST | user | Import products from parsed CSV/XLSX rows (skip/update) | `src/app/api/products/import/route.ts` |
| 58 | `/api/products/lookup` | GET | user | Find product by scanned code or SKU (read-only) | `src/app/api/products/lookup/route.ts` |
| 59 | `/api/products/next-code` | GET | user | Generate unused internal barcode number | `src/app/api/products/next-code/route.ts` |
| 60 | `/api/qrcodes` | GET, POST | user, rate-limited | GET list/search/filter; POST create QR code | `src/app/api/qrcodes/route.ts` |
| 61 | `/api/qrcodes/[id]` | GET, PATCH, DELETE | user | GET / PATCH / DELETE own QR code | `src/app/api/qrcodes/[id]/route.ts` |
| 62 | `/api/qrcodes/[id]/duplicate` | POST | user | Duplicate a QR code (quota-checked) | `src/app/api/qrcodes/[id]/duplicate/route.ts` |
| 63 | `/api/reports` | POST | rate-limited | Public abuse report (rate-limited) | `src/app/api/reports/route.ts` |
| 64 | `/api/uploads` | GET, POST, DELETE | user, rate-limited | GET list; POST upload (multipart); DELETE ?id= | `src/app/api/uploads/route.ts` |
| 65 | `/brand/[name]` | GET | public | Public branding image (immutable, sandboxed SVG) | `src/app/brand/[name]/route.ts` |
| 66 | `/f/[name]` | GET | public | Uploaded file with safe headers | `src/app/f/[name]/route.ts` |
| 67 | `/r/[code]` | GET | public | Dynamic QR redirect (records scan) | `src/app/r/[code]/route.ts` |

## 3. Selected endpoint details

### 3.1 `POST /api/auth/signup`
Request: `{ "name": string(1–80), "email": string, "password": string(8–200, letter+digit), "acceptTerms": true }` (extra fields such as `role` are ignored).
Responses: `201 { user }` + `Set-Cookie: qs_session`; `400` validation; `403` sign-ups closed; `409` e-mail exists; `429` rate limit.

### 3.2 `POST /api/auth/login`
Request: `{ "email", "password" }`. Responses: `200 { user }` + cookie; `401 "Incorrect email or password."` (same for every credential failure); `403` suspended; `429`.

### 3.3 `POST /api/admin/auth/login` → `POST /api/admin/auth/mfa`
Step 1 returns `{ ok: true, mfaSetupRequired }` with a `qs_admin` cookie, or `{ mfaRequired: true, ticket }` (5-minute ticket) when MFA is on. Step 2: `{ ticket, code }` or `{ ticket, recoveryCode }` → `200 { ok, recoveryCodesRemaining? }` + cookie; `401` invalid/replayed code or expired ticket.

### 3.4 `POST /api/qrcodes`
Request:
```json
{ "name": "Shop menu", "type": "url", "content": { "url": "https://example.com" },
  "design": {}, "dynamic": true, "alias": "", "expiresAt": null,
  "utm": { "source": "poster" }, "campaign": "diwali", "trackScans": true }
```
Responses: `201 { item }` where `item.payload` is `https://<origin>/r/<code>` for dynamic codes; `400` invalid content / non-http destination / reserved alias; `403` plan limit or feature not in plan; `409` alias taken.

### 3.5 `GET /r/{code}` (public)
`302 Location: <destination + UTM>` with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`; `302 → /p/{code}` for hosted pages; `404`/`410` HTML pages for unknown, disabled, paused or expired codes.

### 3.6 `POST /api/products`
Request (prices as strings or numbers, stored in paise):
```json
{ "name": "Masala Chai 250g", "sku": "CHAI-250", "price": "149.00", "currency": "INR",
  "stock": 10, "lowStockAt": 5, "category": "Tea",
  "barcodes": [ { "format": "ean13", "value": "2001234567893", "source": "internal", "isPrimary": true } ] }
```
Responses: `201 { item }`; `400` validation (wrong check digit, internal GTIN outside 20–29, …); `403` plan limit; `409` duplicate SKU or barcode.

### 3.7 `POST /api/products/{id}/stock`
Request: `{ "type": "in" | "out" | "adjust", "quantity": integer ≥ 0, "note"?, "reference"? }`.
Responses: `200 { item, entry }`; `400` not enough stock, zero quantity for in/out, archived product; `404` not owned.

### 3.8 `GET /api/products/lookup?code=…&format=…`
Read-only lookup by barcode (any equivalent GTIN form) or SKU. `200 { found: true, matchedBy, item }` or `{ found: false }`.

### 3.9 `POST /api/uploads` (multipart, field `file`)
Allowed: pdf, png, jpg/jpeg, webp, gif, txt, doc/docx, xls/xlsx, ppt/pptx (magic bytes checked). Responses: `201 { item: { …, url: "/f/<name>" } }`; `413` too large; `415` unsupported or mismatched; `403` storage quota. **Known defect D-01:** bodies over 10 MB return `400 "No file received."` even when the plan allows more.

### 3.10 Billing
- `POST /api/billing/subscribe` `{ planId, interval: "month" | "year" }` → checkout parameters (server decides price).
- `POST /api/billing/verify` `{ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }` → `{ status: "active" | "pending" | "failed" }`.
- `POST /api/billing/webhook` — raw body, header `x-razorpay-signature`; `200 processed|ignored|duplicate`, `400` bad signature/JSON, `413` > 256 KB, `503` not configured.
- `POST /api/billing/cancel` `{ atPeriodEnd?: boolean }`.

### 3.11 `GET /api/health` (public)
`200 { "status": "ok" }` or `503 { "status": "degraded" }`. Reveals nothing else.

## 4. Sensitive-data handling

No endpoint returns password hashes, tokens, TOTP secrets, recovery codes or payment credentials (verified by `test:admin` and `test:billing`). Payment configuration endpoints return only status flags. All examples above use placeholder data.
