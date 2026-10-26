# Staging checklist

Work through this on a **staging** server before any real user sees QRSathi.

**What to use:**
- A real HTTPS domain (e.g. `staging.yourdomain.in`).
- A **new, empty** MySQL 8 database.
- **Test** credentials only. Razorpay stays in **test mode** until section 7 passes completely.

**Rules:**
- Never copy the development database (`prisma/dev.db`) to staging or production. It contains test and demo accounts, including a super administrator at a published demo address.
- Never paste secrets into tickets, chats or screenshots. Record **PASS / FAIL** and the date for each item.

## 1. Server and database

| # | Step | Expected |
|---|---|---|
| 1.1 | Create the database and a least-privilege user (`docs/DATABASE.md` §1) | `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` |
| 1.2 | Set the environment: `.env.example` lists every variable; required in production: `DATABASE_URL` (`mysql://…`), `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (`https://…`), `MFA_ENCRYPTION_KEY`, `SMTP_*`, `MAIL_FROM`, `TRUST_PROXY`, `UPLOAD_DIR` (persistent disk) | — |
| 1.3 | `npm ci` → `npm run db:mysql:deploy` → `npm run build` → `npm start` behind your TLS proxy | Migrations "successfully applied"; server starts |
| 1.4 | `DATABASE_URL=… npx prisma migrate status --schema prisma/mysql/schema.prisma` | "Database schema is up to date" |
| 1.5 | Fail-closed check: start once with `SMTP_HOST` unset | Server **refuses to start** with a clear message; restore the variable afterwards |
| 1.6 | `curl -sI https://<staging>/` | `Strict-Transport-Security`, a `Content-Security-Policy` containing `'nonce-…'` and `'strict-dynamic'` (no `'unsafe-inline'` in `script-src`), `X-Content-Type-Options: nosniff` |
| 1.7 | `curl -s https://<staging>/api/health` | `{"status":"ok"}` |

## 2. First administrator and two-factor authentication

| # | Step | Expected |
|---|---|---|
| 2.1 | On the server: `npm run admin -- create --email <you> --super` (type the password when asked) | "created" |
| 2.2 | Sign in at `/admin/login` | Redirected to `/admin/mfa` (the console stays locked until you enrol) |
| 2.3 | Scan the QR with an authenticator app, confirm a code | 10 recovery codes shown **once**: store them offline |
| 2.4 | Sign out, sign in again | Password, then a 6-digit code |
| 2.5 | Try "Turn off" (there is no button) or `POST /api/admin/mfa {action:"disable"}` | Refused (403) |
| 2.6 | Use one recovery code to sign in | Works once; the same code fails the second time |
| 2.7 | Lost-device path: `npm run admin -- reset-mfa --email <you>` on the server, then re-enrol | Works; recorded in Admin → Security → Audit log |

## 3. E-mail (real SMTP; sends real messages to addresses you control)

| # | Step | Expected |
|---|---|---|
| 3.1 | Admin → Email → **Send a test e-mail to me** | Arrives; check spam; SPF/DKIM pass in the headers |
| 3.2 | Sign up a customer with a mailbox you control → **Forgot password** | Same message as for an unknown address; e-mail arrives within a minute |
| 3.3 | Open the link | It points at your **staging domain**; reset works; old sessions are signed out |
| 3.4 | Open the same link again | "invalid or has expired" |
| 3.5 | Set a branding support e-mail; submit `/contact` | Delivered to the support inbox with **Reply-To** set to the sender |
| 3.6 | Admin → Users → **Send password-reset link** | Green only if delivered; a warning otherwise |

## 4. Customer features

| # | Step | Expected |
|---|---|---|
| 4.1 | Sign up, sign out, sign in | Works; session cookie is `Secure; HttpOnly; SameSite=Lax` |
| 4.2 | Static QR (URL, Wi-Fi, UPI, vCard): download PNG/SVG/PDF; scan each with two phones | Scans to the exact content |
| 4.3 | Dynamic QR: create, print or display, scan; change its destination; scan again; pause it | New destination without reprinting; paused page shown |
| 4.4 | Barcode: EAN-13 and Code 128; print a label; scan with a phone and with `/scanner` | Correct values |
| 4.5 | Scanner on a real phone (Android Chrome **and** iOS Safari): camera, upload an image, paste | Camera only offered where it works; links open only after confirmation |
| 4.6 | Products: add a product with a barcode, stock in/out, low-stock alert, CSV import | Correct balances |
| 4.7 | Upload a file to a hosted page; open it directly at `/f/…` | Served with the sandboxing CSP |
| 4.8 | Plan limits: as a Free user, exceed the dynamic-QR limit | Clear 403 message |
| 4.9 | Billing page with checkout **off** | Shows that online payment is unavailable; no checkout button works |

## 5. Admin console

| # | Step | Expected |
|---|---|---|
| 5.1 | Create a second, ordinary admin with the CLI (no `--super`) | Must enrol in MFA before seeing anything |
| 5.2 | As that admin: Plans & pricing, Payment gateway, role changes | Read-only or 403: super-admin-only |
| 5.3 | As a customer: open `/admin` and `/api/admin/stats` | Redirect to admin login / 401 |
| 5.4 | Suspend and reactivate a test customer | They're signed out immediately; audit log entry |

## 6. Backups and recovery (rehearse; don't assume)

| # | Step | Expected |
|---|---|---|
| 6.1 | `mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF …` (`docs/BACKUP-RECOVERY.md`) plus a copy of `UPLOAD_DIR`, both stored off the server, encrypted | Files exist |
| 6.2 | Restore into a **new** database `qrsathi_restore` and run `prisma migrate status` against it | "up to date"; row counts of `User`, `QrCode`, `Product`, `Payment` match |
| 6.3 | Point a second staging instance at the restored database and uploads; sign in; open a dynamic QR | Works |
| 6.4 | Schedule daily backups and a monthly restore test | Written down, with an owner |
| 6.5 | Keep `AUTH_SECRET`, `MFA_ENCRYPTION_KEY` and `SETTINGS_ENCRYPTION_KEY` in a password manager | Losing `MFA_ENCRYPTION_KEY` breaks every admin's 2FA enrolment |

## 7. Razorpay, test mode only

Checkout stays **off in production** until every row here passes on staging.

| # | Step | Expected |
|---|---|---|
| 7.1 | Admin → Payment gateway: enter **test** keys (`rzp_test_…`) and the webhook secret → **Test connection** | "Verified" |
| 7.2 | Razorpay dashboard (test mode) → Webhooks: `https://<staging>/api/billing/webhook`; events `subscription.*`, `payment.failed`, `refund.processed` | Saved |
| 7.3 | Plans & pricing → **Sync with Razorpay** for each paid plan; then enable checkout in **test** mode | Synced |
| 7.4 | Subscribe with Razorpay's test success card | Checkout opens with no CSP errors in the browser console; status goes pending → active only after the webhook; Admin → Payments shows it |
| 7.5 | Subscribe with the test failure card | Failure shown; plan unchanged; failure recorded |
| 7.6 | Dashboard → resend a delivered `subscription.charged` webhook | No duplicate payment; period not extended twice |
| 7.7 | Cancel at period end, then cancel now (Admin → Subscriptions) | Access kept, then ended |
| 7.8 | Refund the test payment in the dashboard | Marked refunded; access ended |
| 7.9 | Only after 7.1–7.8 pass: consider live keys with one small real payment that you refund | — |
