# Deployment and operations

QRSathi is a standard Node.js (Next.js 15) server with a MySQL database and a directory for uploaded files. The setup below is a single VPS or container behind a reverse proxy with HTTPS. It scales to several instances once rate limits use the database store and uploads live on shared storage.

## Requirements

- Node.js 22 LTS (`.nvmrc`), npm 10.
- MySQL 8.0 or newer (tested on 8.4). See [DATABASE.md](DATABASE.md).
- A persistent, backed-up directory for uploads (`UPLOAD_DIR`).
- A domain with HTTPS. Dynamic QR codes encode `https://<your-domain>/r/<code>`, so **keep the domain for as long as printed codes exist.**
- Optional accounts:
  - SMTP for password-reset e-mail;
  - Google Cloud OAuth client;
  - Razorpay (API keys and a webhook).

## 1. Install

```bash
git clone https://github.com/druvemedia/qrsathi.git && cd qrsathi
cp .env.example .env && chmod 600 .env       # fill in values; see the table below
npm ci                                        # generates the Prisma client for DATABASE_URL's provider
npm run db:mysql:deploy                       # apply migrations (non-destructive)
npm run build
npm run admin -- create --email you@company.com --super   # first administrator
npm start                                     # PORT=3000 by default
```

The server **refuses to start in production** if its configuration is unsafe. It checks `src/lib/env-check.ts`:
- `AUTH_SECRET` is missing, short or a placeholder;
- `NEXT_PUBLIC_APP_URL` is missing or not https;
- `DEMO_MODE` is on;
- `RAZORPAY_WEBHOOK_SECRET` is missing while Razorpay is enabled;
- a secret is exposed through a `NEXT_PUBLIC_*` variable.

Warnings, for example about the in-memory rate-limit store, are logged at startup.

### Required production variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `mysql://user:password@host:3306/qrsathi`. Build and run with the same value. |
| `AUTH_SECRET` | 48+ random bytes: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain`, the origin only. **Inlined at build time:** rebuild after changing it. |
| `MFA_ENCRYPTION_KEY` | Recommended. A separate 32+ char key for administrator TOTP secrets. |
| `SETTINGS_ENCRYPTION_KEY` | Only if admins should enter Razorpay credentials in the console (they're stored AES-GCM-encrypted). 32+ chars, different from `AUTH_SECRET`, kept only in the environment. Leave unset to manage credentials with `RAZORPAY_*` variables. |
| `TRUST_PROXY` | `true` behind nginx/Caddy/a load balancer; `cloudflare` behind Cloudflare. |
| `RATE_LIMIT_STORE` | `database` when running more than one instance. |
| `UPLOAD_DIR` | Absolute path on persistent storage. |

The full list is in `.env.example`. Never put secrets in `NEXT_PUBLIC_*` variables: they're sent to every browser.

## 2. Process manager

systemd example (`/etc/systemd/system/qrsathi.service`):

```ini
[Unit]
Description=QRSathi
After=network.target

[Service]
User=qrsathi
WorkingDirectory=/srv/qrsathi
EnvironmentFile=/srv/qrsathi/.env
Environment=NODE_ENV=production PORT=3000
ExecStart=/usr/bin/npm start
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/srv/qrsathi-data/uploads

[Install]
WantedBy=multi-user.target
```

## 3. Reverse proxy, HTTPS and cookies

Terminate TLS at the proxy and forward to `127.0.0.1:3000`. Don't expose port 3000 publicly.

**Caddy** (automatic certificates):
```
your-domain.com {
  reverse_proxy 127.0.0.1:3000
  request_body { max_size 60MB }
}
```

**nginx:**
```nginx
server {
  listen 443 ssl http2;
  server_name your-domain.com;
  # ssl_certificate … (e.g. certbot)
  client_max_body_size 60m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
server { listen 80; server_name your-domain.com; return 301 https://$host$request_uri; }
```

Then set `TRUST_PROXY=true`. The proxy **must overwrite** `X-Real-IP`; otherwise clients can spoof their IP for rate limiting.

How the app handles HTTPS and cookies:
- Session cookies are `HttpOnly`, `Secure` (in production) and `SameSite=Lax` (workspace) / `Strict` (admin console). They only work over HTTPS in production.
- `Strict-Transport-Security` is sent when `NEXT_PUBLIC_APP_URL` is https.
- A Content-Security-Policy and the other security headers are set in `next.config.mjs`.
- CSRF: state-changing API calls must carry an `Origin` equal to `NEXT_PUBLIC_APP_URL` (`src/middleware.ts`). Serve the app on exactly that origin; for example, redirect `www` to the bare domain or the other way round.

## 4. Health check

`GET /api/health` returns `{"status":"ok"}` (HTTP 200), or `{"status":"degraded"}` (503) if the database is unreachable. It reveals nothing else. Use it for load-balancer and uptime checks.

Detailed status (database latency, storage writability, configuration flags) is in the admin console under **System**.

## 5. Logging

- Production logs are JSON lines on stdout/stderr (`LOG_FORMAT=json`, `LOG_LEVEL=info`). Collect them with journald, Docker logging or your platform.
- Every log field passes through redaction:
  - passwords, tokens, cookies, secrets, OTP and recovery codes are replaced with `[redacted]`;
  - e-mail addresses are masked.
- Warnings and errors are also stored in the `Log` table (redacted, max 2,000 chars) for the admin console.
- Security events and administrator actions go to the `AuditLog` table, viewed at `/admin/security`.
- Errors returned to clients are generic. Stack traces are never sent to browsers.

## 6. Upgrades and migrations

```bash
# 1. Back up (see BACKUP-RECOVERY.md)
git pull
npm ci
npm run db:mysql:deploy      # applies new migrations only; never resets
npm run build
sudo systemctl restart qrsathi
curl -fsS https://your-domain/api/health
```

**Rolling back** a release:
1. Check out the previous tag.
2. Run `npm ci && npm run build`, then restart.

Migrations are written to be additive (expand → contract), so the previous release keeps working with the newer schema. If a migration must be reverted, restore the pre-upgrade backup. Don't edit `_prisma_migrations` by hand.

**Never run** `prisma migrate reset`, `prisma migrate dev`, `prisma db push --accept-data-loss` or `npm run seed:demo` against production. The demo seeder refuses to run when `NODE_ENV=production`.

## 7. Integrations

### SMTP (password reset)
Set `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS / 465 TLS), `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM`. Use a transactional provider (SES, Postmark, Mailgun, Zoho) with SPF, DKIM and DMARC set up for the sending domain. Without SMTP, production can't send reset links; development prints them to the console.

### Google sign-in
1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application).
2. Authorised redirect URI: `https://your-domain/api/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Only Google accounts with verified e-mail addresses are accepted. Google sign-in always creates ordinary users.

### Razorpay (subscriptions)
1. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`, or enter them under **Payment gateway** in the admin console (this needs `SETTINGS_ENCRYPTION_KEY`).
2. Razorpay Dashboard → Webhooks: URL `https://your-domain/api/billing/webhook`, with the secret you chose. Select the `subscription.*` events, `payment.failed` and `refund.processed`.
3. In the console:
   - **Test connection** (read-only);
   - sync each paid plan under **Plans & pricing**;
   - enable checkout.
4. Plans change only after Razorpay confirms a captured payment, through the API check or a signed webhook.

Complete the go-live checklist in [BILLING.md](BILLING.md) before switching to live keys. Never set `RAZORPAY_API_BASE` in production: it exists only for the test mock.

## 8. Multiple instances

- Set `RATE_LIMIT_STORE=database`, so rate limits are shared through MySQL.
- Put `UPLOAD_DIR` on shared storage (NFS/EFS). Alternatively, replace `storeFile`, `readStoredFile` and `deleteStoredFile` in `src/lib/storage.ts` with object storage.
- Use one `AUTH_SECRET`, `MFA_ENCRYPTION_KEY` and `SETTINGS_ENCRYPTION_KEY` across all instances.

## 9. Production checklist

- [ ] HTTPS only; HTTP redirects to HTTPS; `NEXT_PUBLIC_APP_URL` is the final https origin.
- [ ] `AUTH_SECRET`, `MFA_ENCRYPTION_KEY` and (if used) `SETTINGS_ENCRYPTION_KEY` are unique random values, stored only in the server's secret store or `.env` (mode 600). Not in git, never in the database.
- [ ] Razorpay go-live checklist completed ([BILLING.md](BILLING.md)); `RAZORPAY_API_BASE` is unset.
- [ ] Branding published: site title, support e-mail, favicon, social image (`/admin/settings/branding`).
- [ ] `DEMO_MODE` is unset or `false`; no demo accounts exist (`npm run admin -- list`).
- [ ] A super administrator exists and has enrolled in 2FA; recovery codes are stored safely.
- [ ] MySQL user has only the privileges it needs; TLS to remote databases; database not publicly reachable.
- [ ] `TRUST_PROXY` matches your proxy; port 3000 is firewalled.
- [ ] `RATE_LIMIT_STORE=database` if there's more than one instance.
- [ ] Uploads on persistent storage; nightly database **and** upload backups, with a restore you have actually tested.
- [ ] SMTP configured and a reset e-mail tested end to end.
- [ ] Razorpay webhook secret set and tested in test mode (if billing is used).
- [ ] `/api/health` monitored; logs collected; disk-space alerting.
- [ ] Privacy Policy and Terms reviewed for your jurisdiction (e.g. India's DPDP Act 2023).
- [ ] `npm audit` reviewed; dependencies kept up to date (Dependabot).
