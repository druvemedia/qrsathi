# Security audit: QRSathi (2026-10-25)

## Scope and method

- **Code review.** Every route under `src/app/api`, `/r`, `/f` and `/p`; authentication, sessions, uploads, billing, logging and configuration.
- **Static checks.** TypeScript strict, ESLint (with `no-eval`/`no-new-func` as errors), `npm audit`, and a dependency-licence scan.
- **Automated tests.** Each fix has a regression test (see the Test column), in four groups:
  - `npm test`: offline unit tests;
  - `test:api` and `test:admin`: HTTP integration tests against a production build;
  - `test:browser`: headless Edge (CSP violations, console errors, layout, accessibility);
  - `test:mysql`: a real MySQL 8.4 server.
- **Environments.** Integration suites ran against two production builds with throw-away databases: one on SQLite, and one on **MySQL 8.4.13** running the migrated development data.

**Not done:**
- No external penetration test.
- No testing against any production system.
- No real Google OAuth, SMTP or Razorpay traffic. The webhook was exercised with locally signed payloads.

**This audit does not show that the application is completely secure.**

Severity reflects impact if exploited in a production deployment.

## Findings and fixes

| # | Severity | Finding | Route / file | Evidence | Fix | Test | Remaining risk |
|---|---|---|---|---|---|---|---|
| 1 | **Critical** | Anyone could become an administrator by signing up, or signing in with Google, using an e-mail listed in `ADMIN_EMAILS`. The address was never verified. | `POST /api/auth/signup`, `/api/auth/login`, `/api/auth/google/callback` | Each route called `isAdminEmail()` and set `role: "admin"` | Auto-promotion removed. Sign-up and OAuth always create `user` and ignore any client-sent role. Admins come only from the server CLI (`npm run admin`) or a super administrator. `ADMIN_EMAILS` is ignored and triggers a startup warning. | `test:admin` → "Sign-up can never create an administrator" (role injection, legacy e-mail) | Accounts promoted this way **before** the fix keep their role. Review with `npm run admin -- list`. |
| 2 | **High** | The admin panel used the ordinary workspace session: no separate sign-in, no MFA, 30-day cookie. | `/admin`, `/api/admin/*` | Admin APIs checked `user.role === "admin"` on the workspace session | Separate console:<br>• own login;<br>• `qs_admin` cookie (`SameSite=Strict`, 12 h max, 2 h idle);<br>• a server-side session of kind `admin`;<br>• deny-by-default `requireAdmin()` on every admin endpoint.<br>TOTP MFA with hashed one-time recovery codes; required for super admins. Roles `user`/`admin`/`super_admin` with server-side permission rules and last-super-admin protection. | `test:admin`:<br>• all 13 admin GET endpoints → 401;<br>• user session → 401;<br>• token swap → 401;<br>• MFA enrolment, replay, recovery codes;<br>• RBAC matrix | MFA is optional for `admin` (a banner and the Security page flag it). Consider making it mandatory. |
| 3 | **High** (if `NEXT_PUBLIC_APP_URL` unset) | Password-reset links were built from the request `Host` header, so a reset could be poisoned to point at an attacker's domain. | `/api/auth/forgot`, `src/lib/api.ts` `baseUrl()` | Fallback used the request origin | Production throws when the public URL isn't configured, and startup validation refuses to start without an https `NEXT_PUBLIC_APP_URL`. | `npm test` → env-check cases | None when deployed as documented. |
| 4 | **High** | A development database backup with 3 bcrypt password hashes, QR codes and scans was committed and pushed. | `prisma/dev.db.backup-20261025-121707` (commit `21277e0`) | `git log --all -- prisma/dev.db.backup-*` | File untracked (local copy kept). `.gitignore` now blocks databases, backups, dumps, keys and uploads. A history-rewrite procedure is documented. | `git check-ignore` verification | **Still in git history** until the owner approves the rewrite and force-push ([OPEN-SOURCE-READINESS.md](OPEN-SOURCE-READINESS.md)). Change the affected passwords. |
| 5 | **High** | Default administrator `admin@demo.local` / `admin12345` was created by the seeder and documented in the README. | `prisma/seed-demo.mjs`, README | Seeder upserted an admin | The seeder never creates admins and refuses to run in production. Demo mode is forced off in production, which also refuses to start with `DEMO_MODE=true`. README no longer lists the credentials. | Startup refusal observed; `npm test` env-check | The account still exists in the local development database. Delete it. |
| 6 | Medium | Logout, password change and "sign out other devices" didn't invalidate existing tokens: the JWTs were stateless. | `src/lib/session.ts` | The token stayed valid until expiry | Server-side `Session` table; the cookie names a session row. Logout deletes the row. Password change, reset, suspension and role change revoke sessions. A new session ID on every sign-in prevents fixation. | `test:admin` → logout invalidation, fixation, password change/reset sign-out, suspension | Users get 30-day sessions (by design); they can sign out other devices. |
| 7 | Medium | IP rate limits could be bypassed by sending a fake `X-Forwarded-For`. | `src/lib/api.ts` `clientIp()` | Left-most XFF entry was trusted | Proxy headers are trusted only with `TRUST_PROXY`; otherwise the right-most XFF entry is used. Per-account and global limits were added on top of per-IP limits. | `npm test` → client-IP cases; `test:admin` → 429 after 5 admin attempts | If deployed behind a proxy **without** `TRUST_PROXY`, all clients share one IP bucket. That's a nuisance, not a bypass. |
| 8 | Medium | Open redirect after login via `next=/\evil.com` and the Google `g_next` cookie. | `/login`, `/api/auth/google*` | Browsers treat `/\` as `//` | `safeNextPath()` rejects schemes, `//`, backslashes and control characters. Admin login accepts only `/admin` paths. | `npm test` → 12 redirect cases | – |
| 9 | Medium | Stored XSS: the admin-editable site name went into a JSON-LD `<script>` unescaped. | `/` (`src/app/(site)/page.tsx`) | `JSON.stringify` doesn't escape `</script>` | `safeJsonLd()` escapes `<`, `>`, `&`, U+2028 and U+2029. | `npm test` + `test:admin` (sets site name to `</script><script>…`) | – |
| 10 | Medium | The CSRF origin check compared against `X-Forwarded-Host`, which the client controls. | `src/middleware.ts` | Forged header made any origin "same-site" | Production accepts only the `NEXT_PUBLIC_APP_URL` origin; forwarded headers are honoured only with `TRUST_PROXY`. | `npm test` → CSRF cases; `test:api`/`test:admin` → cross-site 403 | – |
| 11 | Medium | No Content-Security-Policy or HSTS. | `next.config.mjs` | Response headers | CSP added: `object-src 'none'`, `frame-ancestors 'self'`, `base-uri`/`form-action 'self'`, no remote scripts. HSTS sent over HTTPS. COOP set. Admin pages are `no-store` and `noindex`. | `test:admin` header checks; `test:browser` → **0 CSP violations** across all pages at 3 widths, light and dark | CSP still allows `'unsafe-inline'` scripts (needed by Next.js without nonces). Nonce-based CSP is a future hardening step. |
| 12 | Medium | The billing webhook wasn't idempotent: concurrent duplicate deliveries could each extend the plan. It also had no body-size limit. | `POST /api/billing/webhook` | Non-atomic "already paid" check | Atomic claim (`updateMany … status != paid`) inside a transaction; 256 KB cap; audit entry. | `test:admin` → forged signature, underpaid link, 3 concurrent deliveries → +30 days once, 413 | Not tested against live Razorpay. |
| 13 | Low/Medium | Large request bodies were buffered before size checks. | `/api/uploads`, all JSON routes | `formData()` read the whole body first | `assertBodySize()` before parsing; `readJson()` byte limits per route. | `test:admin` → 11 MB upload → 413 | – |
| 14 | Low | Login revealed that an account exists through a different error for Google-only accounts. | `/api/auth/login` | Distinct message | One generic message for every failure; dummy bcrypt for unknown e-mails. | `test:admin` → identical errors for non-admin, wrong password and unknown e-mail | Sign-up still reports "account exists" (common UX trade-off; rate-limited). |
| 15 | Low | A password-reset token could be used twice by concurrent requests. | `/api/auth/reset` | Non-atomic check | Atomic claim; all other tokens invalidated; sessions revoked. | `test:admin` → single use, expiry, stored only as hash | – |
| 16 | Low | JWT algorithm not pinned. | `src/lib/session.ts` | `jwtVerify` without `algorithms` | HS256 pinned; the token must match the cookie kind. | `test:admin` → user token replayed as admin cookie → 401 | – |
| 17 | Low | Unlimited scan recording per client could inflate a competitor's analytics. | `/r/[code]`, `/p/[code]` | No limit | At most 20 recorded scans per client per code per 10 minutes. Visitors are always redirected. | `test:admin` → 25 visits → 20 scans, all 302 | Distributed clients can still add scans (inherent to public links). |
| 18 | Low | No rate limit on QR creation. | `POST /api/qrcodes` | – | 300 per hour per account (plan limits still apply). | Code-level (not separately tested) | – |
| 19 | Low | Admin support e-mail not validated. | `PUT /api/admin/settings` | Free text | Validated; every settings change is audited. | `test:admin` | – |
| 20 | Low | JWT-shaped tokens (e.g. a pasted session cookie) were not redacted in logs. | `src/lib/redact.ts` | Found by the new unit test | Redaction now masks JWTs, long opaque strings, `token=`/`password=` values, secret-named keys and e-mails. | `npm test` → redaction cases; `test:admin` → no passwords in audit log | Free-text messages are best-effort redacted. |
| 21 | Low | A super admin's refused "disable MFA" request consumed a valid TOTP code first. | `POST /api/admin/mfa` | Found by `test:admin` | The refusal is checked before code verification. | `test:admin` | – |
| 22 | Info | Uploaded files are public to anyone who knows the random file name; this is by design, for hosted pages. | `/f/[name]` | – | Served with `Content-Security-Policy: sandbox`, `nosniff` and allow-listed types (no SVG/HTML). Files of suspended owners are hidden. | Existing tests | Don't upload confidential documents to hosted pages. |
| 23 | Info | `npm audit`: 4 high and 1 moderate advisory in production dependencies. | `next` (bundled PostCSS), Prisma CLI (`deepmerge-ts`) | `npm audit --omit=dev` | Build/CLI-time only, with trusted inputs. Accepted with reasons and an expiry (2027-01-31) in `security/audit-allowlist.json`. CI fails on any new high/critical advisory. | `npm run audit:check` | Upgrade to Next 16 / Prisma 7 to clear them. |

## Other quality fixes found by the new tests

- **Hydration error on `/scanner`.** Clipboard support was read during render. It's now detected after mount.
- **Form labels.** Labels weren't associated with many form controls (`Field` without `htmlFor`). `Field` now links its label, hint and error automatically; specific controls on `/bulk` and `/upi` were labelled. Every page now passes the accessible-name check.
- **Admin tables at tablet width.** Visually hidden table headers widened the page at 768 px. The table container is now `relative`.

## Remaining risks and recommendations

1. Approve and carry out the **git history cleanup** before making the repository public, and rotate the affected passwords (finding 4).
2. Delete the demo administrator and review existing administrators (`npm run admin -- list`) (findings 1 and 5).
3. **E-mail verification** isn't enforced for password sign-ups. No privilege depends on the e-mail address any more, but verification would reduce spam accounts.
4. **Password policy.** Users need 8+ characters with a letter and a digit; administrators need 12+. There's no breached-password check. Consider zxcvbn or HIBP k-anonymity checks.
5. **MFA for every admin.** Required for `super_admin` only. Consider enforcing it for `admin` too.
6. **CSP nonces** would allow removing `'unsafe-inline'` for scripts.
7. **Abuse.** Dynamic QR codes can point anywhere. Phishing is handled through reports and moderation (`/admin/reports`, `/admin/qr-codes`). Consider URL reputation checks (e.g. Google Safe Browsing) on create and update.
8. **Plan-limit race.** Concurrent creates could exceed a plan limit by a few items. Low impact.
9. **Rate limits.** The in-memory store is per instance; use `RATE_LIMIT_STORE=database` when running several instances.
10. **Not covered by this audit:** real Google OAuth, SMTP and Razorpay flows, plus infrastructure (TLS, firewall, database hardening). Use the checklist in [DEPLOYMENT.md](DEPLOYMENT.md#9-production-checklist).
11. **Legal.** Have the Privacy Policy and Terms reviewed (DPDP Act 2023).

## Reproducing the checks

```bash
npm run typecheck && npm run lint && npm test && npm run audit:check && npm run license:check
# Integration (throw-away database + production build), see README → Tests:
npm run test:api && npm run test:admin && npm run test:browser
MYSQL_TEST_URL="mysql://root:pw@127.0.0.1:3306/" npm run test:mysql
```
