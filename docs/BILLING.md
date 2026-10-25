# Billing: Razorpay subscriptions, pricing and entitlements

> **Status:** the subscription flow is implemented and covered by automated tests against a **mock** of the Razorpay API (`npm run test:billing`). It has **not** yet been exercised against Razorpay itself, in test or live mode. Before taking real money, complete the go-live checklist at the end of this page.

## Where things are configured

| What | Where | Who |
|---|---|---|
| Razorpay keys, webhook secret, test/live mode, checkout on/off | `/admin/settings/payments` (or environment variables) | super admin (any admin can view status) |
| Plans, prices, entitlements, pricing page | `/admin/settings/pricing` | super admin (any admin can view) |
| Subscriptions (view, cancel) | `/admin/subscriptions` | super admin cancels; admins view |
| Payment history | `/admin/payments` | admins |
| Customer billing | `/pricing`, Settings → Billing (`/dashboard/settings#billing`) | the customer |

## Credentials and secret storage

Credentials come from one of two sources:

1. **Environment variables (recommended for production).** These are `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`.
   - The key prefix (`rzp_test_` / `rzp_live_`) decides which mode they configure.
   - They take precedence over anything entered in the console, and the console shows them as "set by environment".
2. **Admin console, stored encrypted in the database.** This works only when `SETTINGS_ENCRYPTION_KEY` (32+ characters, different from `AUTH_SECRET`) is set in the server environment.
   - Secrets are sealed with **AES-256-GCM**. The key is derived with HKDF and bound to each field, so a ciphertext copied to another field won't decrypt.
   - The key never touches the database, so a database dump alone doesn't reveal the secrets. Without the key, database storage is disabled and the page says so.

Test and live credentials are stored separately.

How the console handles secrets:
- **They never leave the server.** The settings API returns only "configured" flags, verification status and timestamps.
  - It doesn't return masked fragments or the last four characters, not even to super admins.
  - The Key ID is shown, because it is a public identifier that Razorpay Checkout needs in the browser.
- **Entry and replacement.** Secret fields have a show/hide (eye) toggle while you type. After saving, they are cleared from the browser.
  - Replacing a secret never reveals the old one, and "Remove" clears it explicitly.
- **Re-authentication.** Changing credentials or enabling checkout requires a sign-in or password (plus 2FA) re-confirmation within the last 15 minutes.
- **Auditing.** Every change is audited by field name only (`keySecret`, `webhookSecret:cleared`, …), never with values.
- **Reset on change.** A new Key ID or Key Secret resets verification and switches checkout off for that mode.

### Test connection

**Test connection** makes one **read-only** call (`GET /v1/plans?count=1`). It creates nothing and charges nothing. The result is one of:

| Status | Meaning |
|---|---|
| Missing / Incomplete | Key ID, Key Secret or Webhook Secret not entered |
| Not verified | Entered but not tested since the last change |
| **Verified** | Razorpay accepted these exact credentials (stored as a fingerprint of key ID + secret) |
| Invalid | Razorpay rejected them (401) |
| Unable to verify | Timeout, network or Razorpay error. Not treated as valid. |

The webhook secret **can't** be checked remotely. It is confirmed when Razorpay delivers a correctly signed event, and the page shows the time of the last signed webhook.

Checkout can be enabled only for a mode whose credentials are complete **and** verified. Invalid live keys can't enable live billing.

## Customer flow

1. On `/pricing` the customer chooses a published paid plan and an interval. The browser sends **only the plan id and interval**.
2. `POST /api/billing/subscribe` checks everything on the server:
   - the plan is published, paid and offers that interval;
   - checkout is enabled and the credentials are verified;
   - the customer has no live subscription;
   - a Razorpay plan exists for the **current** price.

   It then creates a Razorpay subscription and stores a snapshot of the plan, amount and currency (status `created`).
3. Razorpay Checkout opens in a Razorpay iframe. Card and UPI details never touch this site.
4. Checkout's handler response goes to `POST /api/billing/verify`, which:
   - verifies `HMAC_SHA256(payment_id + "|" + subscription_id, key_secret)`;
   - **fetches the payment and subscription from Razorpay**;
   - grants the plan only if the payment is `captured` with the expected amount, currency and Razorpay plan.

   Otherwise the status stays **pending**.
5. `POST /api/billing/webhook` processes the signed events (see below) and confirms or updates everything authoritatively.
6. The customer lands on `/billing/status`. It polls the server's own records and shows **active**, **pending** (still waiting for confirmation) or **failed**.

   Returning to a success URL never activates anything.

Access lasts until Razorpay's `current_end` for the period, plus 24 hours of grace to absorb webhook delays at renewal. It is renewed by each `subscription.charged` event.

## Webhooks

Configure `https://<your-domain>/api/billing/webhook` in the Razorpay Dashboard → Webhooks, separately for test and live mode, each with its own secret. Select these events:

`subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `subscription.paused`, `subscription.resumed`, `payment.failed`, `refund.processed`. Also select `payment_link.paid` if you still have legacy 30-day passes.

Every delivery goes through these steps:

1. **Size and signature first.** Bodies over 256 KB are refused. `X-Razorpay-Signature` is verified against the **raw body** with each configured webhook secret, and the matching secret tells us the mode.
2. **Ledger.** The event is recorded in `WebhookEvent`, unique on `(provider, X-Razorpay-Event-Id)`. Duplicates are answered `200 duplicate` without effects.
3. **Validation.** Events are checked before they change anything:
   - the subscription must be known and its mode must match the signing secret;
   - the Razorpay plan id and the owner (`notes.userId`) must match;
   - for charges, the payment must be `captured` and its amount and currency must equal the subscription snapshot.

   Any mismatch is **rejected** and logged, and nothing changes.
4. **Idempotent effects.** Even when two different deliveries describe the same payment:
   - payments are unique by Razorpay payment id, so they can't be recorded twice;
   - period ends are *set* from Razorpay's value, never added;
   - refunds use Razorpay's cumulative `amount_refunded`.

| Event | Effect |
|---|---|
| `subscription.charged` | Records the payment and sets the plan until the new period end (activation and renewals) |
| `subscription.authenticated` / `activated` | Status update (the plan itself is granted on the charge) |
| `subscription.pending` | Renewal charge failed and Razorpay is retrying; access continues |
| `subscription.halted` / `paused` | Paid access ends now |
| `subscription.cancelled` / `completed` | Status update; access continues until the end of the paid period |
| `payment.failed` | Failed payment recorded (when Razorpay links it to a known subscription) |
| `refund.processed` | Refunded amount recorded. A **full** refund of the latest payment ends paid access now. |

The ledger stores only the event type and a short summary, never raw payloads. Card details, payment credentials and secrets are never logged.

## Cancellation

Customers cancel in Settings → Billing, which cancels at the end of the period. Razorpay won't charge again, and the plan stays until the period ends.

Super admins can also cancel from `/admin/subscriptions`, either at period end or immediately. Immediate cancellation ends access now and makes **no automatic refund**: issue refunds in the Razorpay Dashboard. The resulting `refund.processed` webhook is recorded automatically.

## Plans and prices

- Plans live in the `PricingPlan` table. They are seeded once from defaults (Free, Pro, Business) **only when the table is empty**.
- Prices are integer **minor units** (paise), and the currency is stored explicitly. The editor parses amounts with exact string arithmetic; there is no floating point anywhere.
- **Validation.** Prices can't be negative or fractional, and paid prices must be at least 1.00, which is Razorpay's minimum. The Free plan can't have a price or be archived. Limits and currencies are checked against allow-lists.
- **Lifecycle.**
  - Plans start as drafts. Publishing puts them on `/pricing`; unpublishing hides them.
  - Archived plans can't be bought, but **existing subscribers keep their entitlements** until their subscription ends.
  - Plans are never deleted.
- **Price changes don't touch existing subscriptions.** Razorpay plans are immutable, so:
  - when a price or currency changes, the old Razorpay plan stays attached to existing subscriptions, which keep renewing at their recorded price;
  - new checkouts are refused ("not ready") until you press **Sync** to create a Razorpay plan for the new price;
  - if live subscriptions exist, the change needs explicit confirmation.
- **History stays intact.** Payment amounts are snapshots and are never rewritten.
- **Without verified Razorpay configuration**, plans can still be saved, published and previewed. Sync stays "pending" and nothing pretends to be synced.
- **Trials are not implemented.** None are offered or advertised.

## Entitlements (server-side)

Each plan's `limits` are enforced on the server, using the same rules everywhere:

| Limit | Enforced in |
|---|---|
| Saved QR codes / dynamic / hosted | QR create & duplicate (`src/lib/qr-service.ts`) |
| Products, stored barcodes | Product create, edit and import (`src/lib/products.ts`, import route) |
| Bulk rows | Product import; bulk generator UI |
| Largest upload / total storage | `/api/uploads` |
| Analytics days (0 = none), CSV export | `/api/analytics`, `/api/analytics/export` |
| Custom alias, expiry dates | QR create/update |
| Export formats, priority support | Shown on the plan. Static images rendered in the browser can't be technically restricted. |

Quota checks and the insert they protect run in one transaction that starts with a locking `UPDATE` on the user row (`src/lib/entitlements.ts`). This serialises concurrent requests from the same account on both SQLite and MySQL. The concurrency test fires 8 parallel creates at a limit with one slot left, and exactly one succeeds.

## Testing

```bash
# Server started with RAZORPAY_API_BASE=http://127.0.0.1:3999 and SETTINGS_ENCRYPTION_KEY set,
# and without RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET:
BASE_URL=http://localhost:3100 DATABASE_URL=file:/abs/test.db npm run test:billing
```

The script starts a deterministic Razorpay mock on port 3999 (`MOCK_PORT`). `RAZORPAY_API_BASE` exists only for this; the server warns at startup if it is set in production.

**Verified with the mock (SQLite and MySQL 8.4):**
- credential validation, masking and encryption at rest;
- re-authentication; invalid credentials can't enable live billing;
- forged checkout signatures and forged webhooks;
- duplicate and concurrent webhook deliveries;
- amount, currency, plan and mode mismatches;
- activation only after a captured payment;
- pending, failed, renewal, halt, cancel, partial and full refund;
- price changes with existing subscribers, archived plans, server-priced checkout;
- quota races, branding uploads and XSS, and secrets in pages, APIs and logs.

**Not verified against real Razorpay:**
- Checkout.js in a browser;
- real webhook delivery and the exact payload shapes, especially `payment.failed` for subscriptions;
- Razorpay's own retry, halt and refund behaviour.

## Go-live checklist

1. **Test mode first.** In Razorpay **test mode**:
   - enter or verify credentials and enable checkout;
   - sync each paid plan;
   - subscribe with a test card or UPI, and confirm the plan activates;
   - check `/admin/payments` and the `WebhookEvent` ledger.
2. **Exercise the failure paths.** In the Razorpay Dashboard, trigger a failed payment, a renewal (or use test clock settings), a cancellation and a refund. Confirm each is reflected correctly.
3. **Test webhook retries.** Use the Dashboard's webhook delivery log to resend an event, and check it's answered `duplicate`.
4. **Go live.** Switch to live keys, verify, sync the plans in live mode, then enable checkout.
5. **Real payment.** Make one real low-value purchase and refund it.
6. **Keep secrets out of the database if you can.** Prefer environment variables, or a managed secret store, for live credentials.
