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

[[API_TABLE]]

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
