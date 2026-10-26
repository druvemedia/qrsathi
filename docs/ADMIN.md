# Administration: roles, the admin console and recovery

## Two separate sign-ins

| | Customer workspace | Admin console |
|---|---|---|
| Sign in | `/login`, `/signup`, `/forgot-password`, `/reset-password` | `/admin/login`, `/admin/forgot-password` |
| Cookie | `qs_session`: 30 days, `SameSite=Lax` | `qs_admin`: 12 hours max, ends after 2 hours idle, `SameSite=Strict` |
| Who | Everyone | `admin` and `super_admin` accounts only |
| Navigation | Workspace sidebar | Separate console layout (`/admin/*`) |

Both use the same accounts table, password hashing (bcrypt, cost 12), server-side session store and rate limits. Authorisation is separate:
- A workspace session never grants admin access, even for an administrator.
- Every `/api/admin/*` endpoint requires an admin-console session (deny by default).

Both cookies are `HttpOnly`. They are `Secure` in production. Each sign-in creates a new session ID, which prevents session fixation. Sign-out deletes the server-side session.

## Roles (RBAC)

Roles are assigned **only on the server**: by the CLI below, or by a super administrator in the console.
- Sign-up forms, Google sign-in and every client API ignore any role sent by the client and always create `user`.
- `ADMIN_EMAILS` from older versions is **ignored**. It no longer grants anything, and the server warns if it is set.

| Capability | user | admin | super_admin |
|---|:-:|:-:|:-:|
| Own workspace: QR codes, products, analytics | ✅ | ✅ | ✅ |
| Admin console: overview, analytics, moderation, reports, payments, system | – | ✅ | ✅ |
| Suspend or reactivate users, sign them out, send reset links, change plans | – | ordinary users only | everyone except self |
| Change roles, delete accounts | – | – | ✅ (never self) |
| Change plans and prices, payment gateway, subscriptions | – | – | ✅ |
| Must use two-factor authentication | – | **required** | **required** |

Guards:
- The last active super administrator can't be demoted, suspended or deleted.
- Suspending an account or changing its role signs that account out everywhere immediately.
- Demoting an account to `user` clears its MFA enrolment.

### Privacy boundary

Administrators manage the platform, not customers' private content:
- The console lists **public-facing** QR codes (dynamic redirects and hosted pages) for moderation. Static codes are only counted.
- Product catalogues, inventory and individual scans are shown **only as aggregates**.
- Password hashes, reset tokens, MFA secrets and recovery codes are never returned by any API.
- Administrators never see or set passwords. They can send a reset link to the account's own address.

## Creating the first administrator (bootstrap)

On the server, with the production `DATABASE_URL` in the environment or `.env`:

```bash
npm run admin -- create --email you@company.com --name "Your Name" --super
```

- You're prompted twice for the password (hidden input). It must be at least 12 characters, contain letters and numbers, and not include your e-mail name or a common word.
- For automation, pipe it in: `printf '%s\n' "$ADMIN_PASSWORD" | npm run admin -- create --email … --super --password-stdin`. Passwords are never accepted as command-line arguments.
- Then open `/admin/login`. Every administrator is sent straight to **Two-factor authentication** and must enrol before using anything else.

Other commands:

```bash
npm run admin -- list                                 # administrators, status, 2FA
npm run admin -- promote --email someone@company.com [--super]
npm run admin -- demote  --email someone@company.com  # back to an ordinary user
npm run admin -- reset-mfa --email someone@company.com
```

Every CLI action is written to the audit log with actor `cli`.

> **Upgrading from an older version:** accounts that were made admins through `ADMIN_EMAILS` keep their `admin` role. Run `npm run admin -- list` to review them, demote any you don't recognise, and create a super administrator. Delete the demo administrator (`admin@demo.local`) from any database that isn't a throw-away development copy.

## Two-factor authentication (TOTP)

- **Enrol** at `/admin/mfa`: scan the QR code with an authenticator app, then enter a code to confirm.
  - MFA is switched on **only after** a correct code.
  - When it's enabled, every other session is signed out.
- **Recovery codes.** You get 10 single-use codes, shown once.
  - Only their SHA-256 hashes are stored.
  - Regenerating them (which needs a current code) invalidates the old set.
- **Secret storage.** TOTP secrets are encrypted with AES-256-GCM. The key is derived from `MFA_ENCRYPTION_KEY`, or from `AUTH_SECRET` if that isn't set.
  - Set `MFA_ENCRYPTION_KEY` in production, so that rotating `AUTH_SECRET` doesn't break enrolled authenticators.
  - Changing or losing `MFA_ENCRYPTION_KEY` makes every enrolment unreadable. Administrators would then need `reset-mfa`.
- **Codes.** 30-second steps; one step of clock drift is accepted. A code can't be reused.
- **It can't be turned off.** Two-factor authentication is required for every administrator (since 2026-10-26). An administrator without it can sign in with their password but only reaches the enrolment page until they finish. Use the lost-authenticator steps below instead of turning it off.

### Lost authenticator

1. Use a recovery code on the second sign-in step ("Use a recovery code").
2. If no codes are left:
   - another super administrator can demote and re-promote the account in the console, which clears MFA;
   - or the server operator runs `npm run admin -- reset-mfa --email …`.

   **Verify the person's identity out of band first.**

### Forgotten password

Use `/admin/forgot-password`. It's the same non-enumerating reset flow as customers use:
- one-time token, valid for 1 hour, stored hashed;
- a successful reset signs out every session.

MFA stays enabled after a reset. Afterwards, sign in again at `/admin/login`.

## Website branding and appearance

- **What's configured.** `/admin/settings/branding` covers the name, titles, title template, descriptions, SEO and social text, contact details, footer, favicon and social image. `/admin/settings/appearance` covers the brand and accent colours, the default theme, the header style and the logo variants for light and dark backgrounds.
- **Draft workflow.** Edits are saved as a **draft** and shown in a live preview (light and dark). They reach the live site only when you **Publish**, which needs confirmation. You can also discard the draft, reset to the defaults (into the draft), or cancel unsaved edits. Leaving the page with unsaved changes asks for confirmation first.
- **Publishing and metadata.** Published values drive the `<title>`, the meta description, Open Graph and Twitter cards, the favicon and the CSS colour variables, using the Next.js metadata API.
- **Validation.** Text fields reject markup and control characters; colours must be `#rrggbb`. Button text automatically switches to black or white for contrast.
- **Uploads.** PNG, JPEG, WebP or plain SVG, checked by:
  - magic bytes and the dimensions read from the file header;
  - size limits (logo 1 MB, favicon 256 KB and square, social image 2 MB);
  - a strict SVG reject-list: no scripts, event handlers, external references or entities.

  Files get new random names, so pages still using the old image keep working. Unused old uploads are cleaned up when you publish, keeping the five newest per kind. Images are served from `/brand/<name>` with a sandboxing CSP.
- **Who can change it.** Any administrator, and every change is audited.

## Plans, pricing and payments

See [BILLING.md](BILLING.md).
- Plans and prices are edited at `/admin/settings/pricing`.
- The payment gateway is configured at `/admin/settings/payments`; credential changes need a password re-confirmation.
- Both are super-admin actions; other administrators can view them.

## Audit log

`/admin/security` shows sign-in failures, MFA events and every administrator action: who, what, target, when, and a hashed IP.
- Details are redacted before storage: no passwords, tokens or secrets.
- Application warnings and errors are listed under `/admin/system`.
