# Chapter 6: Implementation and Evaluation

## 6.1 Introduction

This chapter explains how the design of Chapter 4 is realised in code. It describes the development set-up, the folder structure and the implementation of each module, with short excerpts from the real source files (file paths are given for each excerpt; excerpts are abridged only where marked). It then gives the installation, execution and deployment procedures, presents screenshots captured from the running application, and evaluates the implementation against the objectives.

The audited code base contains about 20,200 lines of TypeScript/TSX in `src/` (57 pages, 67 route handlers — 64 under `/api` — and 31 component files), 22 database models, and about 2,700 lines of test and tooling scripts.

## 6.2 Development Environment Setup

1. Install Node.js 22 (the repository's `.nvmrc` pins major version 22; `package.json` requires `>=22.5.0`) and npm 10.
2. Clone the repository and run `npm install`. The `postinstall` script generates the Prisma client (`scripts/db/prisma.mjs generate`) and copies the zxing WebAssembly file into `public/zxing/`.
3. Copy `.env.example` to `.env` and set at least `DATABASE_URL="file:./dev.db"`, a random `AUTH_SECRET` of 32+ characters and `NEXT_PUBLIC_APP_URL="http://localhost:3000"`.
4. Create the development database with `npm run db:push`.
5. Create the first administrator with `npm run admin -- create --email you@example.com --super` (the password is read from standard input, never from the command line).
6. Start the development server with `npm run dev` and open `http://localhost:3000`.

Optional: `npm run seed:demo` loads demo data when `DEMO_MODE=true` (development only).

## 6.3 Installation and Configuration

Configuration is entirely through environment variables (Table 3.6). The application validates them at start-up (`src/lib/env-check.ts`); in production any error stops the server, and warnings are logged. Secrets are never committed: `.gitignore` excludes `.env*` (except `.env.example`), databases, backups, uploads and logs. Optional integrations are enabled simply by setting their variables: Google sign-in (`GOOGLE_CLIENT_ID/SECRET`), SMTP (`SMTP_*`, `MAIL_FROM`) and Razorpay (environment variables, or encrypted database storage configured from the admin console when `SETTINGS_ENCRYPTION_KEY` is set).

## 6.4 Project Folder Structure

```text
qrsathi/
├── .github/            CI workflow, Dependabot, issue/PR templates
├── docs/               ADMIN, BACKUP-RECOVERY, BARCODES, DATABASE, DEPLOYMENT,
│                       LICENSING, OPEN-SOURCE-READINESS, SECURITY-AUDIT
├── prisma/
│   ├── schema.prisma   canonical schema (SQLite provider)
│   ├── mysql/          generated MySQL schema + migrations
│   └── seed-demo.mjs   development demo data
├── public/             static assets (zxing WASM copied at install)
├── scripts/            admin CLI, DB tools, test suites, audit/licence checks
├── security/           dependency-advisory allowlist
├── src/
│   ├── app/
│   │   ├── (site)/     public marketing pages
│   │   ├── (auth)/     login, signup, forgot/reset password
│   │   ├── (app)/      signed-in workspace (generator, products, …)
│   │   ├── admin/      admin console: (auth) sign-in, (console) pages
│   │   ├── api/        64 API route modules
│   │   ├── r/ p/ f/ brand/   public redirect, hosted page, files, brand images
│   │   └── layout.tsx, globals.css, robots.ts, sitemap.ts
│   ├── components/     UI components (qr/, barcode/, admin/, pricing/, …)
│   ├── lib/            domain and infrastructure modules (58 files)
│   ├── middleware.ts   CSRF origin check
│   └── instrumentation.ts  start-up configuration validation
├── package.json, next.config.mjs, tailwind.config.ts, tsconfig.json
└── eslint.config.mjs, postcss.config.mjs
```

The full tree is in Appendix A. Route groups in parentheses (for example `(app)`) organise layouts without appearing in URLs.

## 6.5 Frontend Implementation

The frontend uses the Next.js App Router. Layouts provide three shells: the public site (`src/app/(site)/layout.tsx`), the workspace with sidebar and command palette (`src/components/app-shell.tsx`), and the admin console (`src/components/admin/admin-shell.tsx`). Pages that need data on first render are server components; interactive tools are client components (`"use client"`).

The QR workbench (`src/components/qr/workbench.tsx`) composes four parts: the type selector, a **generic form renderer** (`type-form.tsx`) that draws fields from the type definition in `qr-types.ts`, the design panel, and the preview/export panel. Because each QR type declares its own fields and zod schema, adding a type requires no new form code. Styling uses Tailwind utility classes; brand colours are CSS variables so that administrators can re-brand the site without rebuilding. Charts use Recharts and notifications use Sonner.

## 6.6 Backend Implementation

Every API endpoint is a route handler wrapped in `handle()`, which centralises error handling. A typical handler authenticates, rate-limits, validates and delegates:

```ts
// src/app/api/qrcodes/route.ts (POST handler)
export const POST = handle(async (req) => {
  const user = await requireUser();
  await rateLimit(`qr-create:${user.id}`, 300, 60 * 60 * 1000);
  const input = await readJson(req, createSchema);
  const qr = await createQr(user, input, baseUrl(req));
  await logEvent("info", "qr.created", `${qr.type}${qr.isDynamic ? " (dynamic)" : ""} ${qr.shortCode ?? ""}`, user.id);
  return json({ item: serializeQr(qr) }, 201);
});
```

`handle()` converts domain errors to HTTP responses and hides unexpected errors from clients:

```ts
// src/lib/api.ts
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message, details: e.details }, e.status);
      const msg = e instanceof Error ? e.message : String(e);
      await logEvent("error", "api.unhandled", `${req.method} ${new URL(req.url).pathname}: ${msg}`.slice(0, 1000));
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}
```

## 6.7 Database Implementation

Prisma Client is created once per process (`src/lib/db.ts`) and reused (in development it is cached on `globalThis` to survive hot reloads). The canonical schema `prisma/schema.prisma` targets SQLite. `npm run db:mysql:schema` generates `prisma/mysql/schema.prisma`, adding MySQL column types; migrations for MySQL live in `prisma/mysql/migrations` and are applied with `npm run db:mysql:deploy`. `npm run db:migrate-data` copies an existing SQLite database into an empty MySQL database with pre-flight checks (orphaned foreign keys, case-only duplicate e-mails) and verification. Both paths were exercised by `test:mysql` (32/32 passed).

Transactions are used wherever several rows must change together: quota checks with inserts (`withQuota`), stock movements, product creation with barcodes and ledger entry, payment application and token claims.

## 6.8 Authentication Implementation

Sessions are stored in the database and referenced by a signed cookie. A request is authenticated only if the token is valid **and** the session row and user still match:

```ts
// src/lib/session.ts — load() (abridged)
const session = await db.session.findUnique({ where: { id: p.sid }, include: { user: true } });
const now = new Date();
if (!session || session.userId !== p.sub || session.kind !== kind || session.expiresAt < now) return null;
const user = session.user;
if (user.status !== "active" || user.sessionVersion !== p.sv) return null;
if (kind === "admin") {
  if (!isAdminRole(user.role)) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > ADMIN_IDLE * 1000) { /* delete and */ return null; }
  // MFA-enabled administrators must have verified MFA in this session.
  if (user.mfaEnabledAt && !session.mfa) return null;
}
```

Incrementing `sessionVersion` (on password change, reset, suspension or role change) therefore invalidates every token at once. Login is protected by three rate limits and a dummy bcrypt comparison for unknown accounts (`src/lib/auth-flow.ts`). The TOTP verifier accepts one step of clock drift and returns the matched step so the caller can reject replays:

```ts
// src/lib/mfa.ts
export function verifyTotp(secret: string, code: string, lastStep = 0, now = Date.now()): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const s = currentStep(now);
  for (const step of [s - 1, s, s + 1]) {
    if (step <= lastStep) continue;
    const expected = Buffer.from(totpAt(secret, step));
    if (timingSafeEqual(expected, Buffer.from(c))) return step;
  }
  return null;
}
```

The admin MFA route then advances `mfaLastStep` with a conditional `updateMany(... mfaLastStep: { lt: step })`, so two concurrent requests cannot both use the same code.

CSRF protection is implemented in the middleware by comparing the `Origin` header of state-changing API requests with the configured application origin:

```ts
// src/middleware.ts (abridged)
if (["GET", "HEAD", "OPTIONS"].includes(method)) return NextResponse.next();
if (req.nextUrl.pathname.startsWith("/api/billing/webhook")) return NextResponse.next();
const origin = req.headers.get("origin");
if (!origin) return NextResponse.json({ error: "Missing origin." }, { status: 403 });
if (!allowedOrigins(req).has(new URL(origin).origin))
  return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
```

## 6.9 QR Code Module Implementation

`src/lib/qr-types.ts` is a registry of 27 types. Each entry declares fields, defaults, a zod schema and a `build()` function that produces the encoded text:

```ts
// src/lib/qr-types.ts (first entry)
{
  id: "url", label: "Website URL", description: "Open any web page", category: "basic", icon: "Globe",
  fields: [{ name: "url", label: "Website URL", kind: "url", placeholder: "https://yourwebsite.com", required: true }],
  defaults: { url: "https://example.com" },
  schema: z.object({ url: url("Website URL") }),
  build: (d) => d.url,
  dynamicCapable: true, logo: "link", caption: "SCAN ME",
},
```

The 27 types are: Website URL, Dynamic URL, Text, vCard, Phone, SMS, E-mail, Wi-Fi, WhatsApp, Instagram, Facebook, YouTube, LinkedIn, Maps, UPI, Bank (account + IFSC as UPI), Product, File, Event, App, Links (link-in-bio), Menu, Business, Feedback, Coupon and Landing page. Some types (for example menus and link lists) are **hosted**: the QR code points to `/p/{code}`, where the content is rendered as a mobile page.

`src/lib/qr-render.ts` turns a payload and a design into SVG using the `qrcode` library's module matrix. The design model supports foreground/background colours, transparency, linear/radial gradients, module styles, finder-eye shapes (square, rounded, circle, leaf), a centre logo, six frame styles with captions, background patterns, error-correction level and quiet-zone margin. When a logo is present, error correction is raised to H automatically:

```ts
// src/lib/qr-render.ts
export function effectiveEcc(design: QrDesign): Ecc {
  if (design.logo && ECC_ORDER.indexOf(design.ecc) < 3) return "H";
  return design.ecc;
}
```

`designWarnings()` warns about low contrast or oversized logos, and the export panel performs a **scan test**: the exported image is decoded again with `jsqr` and compared with the expected payload ("Scan test passed — decodes to your exact content", visible in Figure 6.3). Exports are produced in the browser: PNG/JPG via canvas, SVG directly, PDF via jsPDF and ZIP via JSZip (`src/lib/qr-export.ts`).

## 6.10 Barcode Module Implementation

`src/lib/barcodes.ts` defines 23 formats in four groups: retail (EAN-13, EAN-8, UPC-A, UPC-E, ISBN, ISSN), general (Code 128, Code 39, Code 93, Codabar), logistics (GS1-128, ITF, ITF-14, Standard 2 of 5, MSI) and 2D (Data Matrix, GS1 DataMatrix, PDF417, Aztec, Micro QR, GS1 QR). Each format has a validator; rendering uses bwip-js. GS1 check digits use the standard weighted modulo-10 algorithm [9], [10]; rendering uses bwip-js [25] and decoding zxing-wasm [26]:

```ts
// src/lib/barcodes.ts
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w;
  return (10 - (sum % 10)) % 10;
}
```

To match scanned codes to products, every barcode also stores a **lookup key**. GTIN-family numbers are normalised to 14 digits, so a UPC-A label scanned as its 13-digit EAN form still matches:

```ts
// src/lib/barcodes.ts
export function lookupKey(formatId: string, value: string): string {
  const v = value.trim();
  if (formatId === "upce" && /^[01]\d{7}$/.test(v)) return upceToUpca(v).padStart(14, "0");
  if (["ean13", "ean8", "upca", "itf14", "isbn", "issn"].includes(formatId) && /^\d{8,14}$/.test(v)) return v.padStart(14, "0");
  const gs1 = parseGs1(v);
  const gtin = gs1?.find((p) => p.ai === "01")?.value;
  if (gtin) return gtin;
  return v;
}
```

Internal numbers generated by the system always use the GS1 restricted-circulation prefix 2 (`generateInternalNumber`), and `isRestrictedCirculation` rejects "internal" numbers outside it. Labels are composed as SVG in six sizes from 38 × 25 mm to 100 × 150 mm and four layouts (barcode only, product, shelf, compact).

The scanner (`src/app/(app)/scanner/scanner.tsx`) loads zxing-wasm lazily (`src/lib/zxing-client.ts`), decodes camera frames or uploaded images (several codes per image), classifies the text (`scan-classify.ts`), merges duplicate detections (`scan-merge.ts`) and shows safety notes from `content-safety.ts`. History is kept only in the browser's `localStorage` (`scan-history.ts`) and can be exported to CSV.

## 6.11 Product and Inventory Implementation

`src/lib/products.ts` contains the product logic. Prices are parsed from strings such as "₹1,499.50" and stored in paise; integer fields reject non-integers and out-of-range values; barcodes are validated, rendered once (to apply encoder rules) and normalised. The stock-out movement uses a conditional update so that stock cannot become negative even under concurrent requests:

```ts
// src/lib/products.ts — moveStock() (abridged)
} else if (input.type === "out") {
  delta = -input.quantity;
  const res = await tx.product.updateMany({ where: { id, stock: { gte: input.quantity } }, data: { stock: { decrement: input.quantity } } });
  if (res.count === 0) {
    const cur = await tx.product.findUnique({ where: { id }, select: { stock: true } });
    throw new ApiError(400, `Not enough stock: ${cur?.stock ?? 0} available, ${input.quantity} requested.`);
  }
}
// … every movement then appends an InventoryTransaction with the signed delta and the resulting balance
```

Plan limits are enforced in the same transaction as the insert. `withQuota` first increments the user's `quotaLock` column, which serialises concurrent requests by the same user:

```ts
// src/lib/entitlements.ts
export async function withQuota<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { quotaLock: { increment: 1 } } });
    return fn(tx);
  }, { maxWait: 10_000, timeout: 20_000 });
}
```

The import endpoint accepts rows parsed in the browser from CSV or XLSX (snake_case headers), supports `skip` and `update` modes, rejects duplicates within the file, and records stock changes from imports as logged adjustments.

## 6.12 Administrative Functionality

The admin console (`src/app/admin/(console)`) has pages for the platform overview, users, QR codes, abuse reports, products and barcodes, inventory, analytics, subscriptions, payments, security (audit log, administrators, security events), settings (general, branding, appearance, e-mail, pricing, payment gateway), system health and the administrator's own MFA. Permission rules for actions on accounts are centralised in `src/lib/admin-users.ts`: administrators may act only on ordinary users; only super administrators may change roles or delete accounts; nobody may change their own status or role; and the last active super administrator can never be demoted, suspended or deleted. The command-line tool `scripts/admin.mts` creates, promotes, demotes and lists administrators and resets a lost MFA enrolment (`reset-mfa`), and refuses weak passwords or passwords passed as arguments.

## 6.13 Dynamic QR Implementation

When a dynamic code is created, `createQr()` allocates a short code (seven random characters, retried up to six times, or a validated alias), stores the destination separately from the payload, and sets the payload to `{base}/r/{code}`. The redirect handler (`src/app/r/[code]/route.ts`) checks existence, hosted status, administrator/owner status, pause, expiry and destination, records the scan and returns:

```ts
// src/app/r/[code]/route.ts
await recordScan(qr, req.headers, clientIp(req));
return new Response(null, {
  status: 302,
  headers: {
    Location: withUtm(qr.destination, qr.utm),
    "Cache-Control": "no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex",
  },
});
```

`no-store` prevents browsers and proxies from caching the redirect, so an edited destination takes effect immediately. `recordScan()` ignores bots, caps recording at 20 scans per client per code per 10 minutes, and stores only coarse device information and a salted per-day visitor hash — or only a count if the visitor sends Do-Not-Track/GPC or the owner disabled detailed tracking.

## 6.14 Subscription and Payment Implementation

Billing is implemented with Razorpay Subscriptions (`src/lib/billing.ts`, `src/lib/razorpay.ts`). Super administrators edit plans (`/admin/settings/pricing`); a plan's price is synchronised to an immutable Razorpay plan (`ProviderPlan`). At checkout the client sends only `planId` and `interval`; the server looks up the price. Signatures are verified with HMAC-SHA256 [14] and a constant-time comparison, following Razorpay's documented scheme [21], [22]:

```ts
// src/lib/razorpay.ts
function safeEqualHex(expected: string, given: string) {
  const a = Buffer.from(expected, "utf8"), b = Buffer.from(given || "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
/** Webhooks: HMAC_SHA256(raw request body, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string) {
  return safeEqualHex(createHmac("sha256", webhookSecret).update(rawBody).digest("hex"), signature);
}
```

A plan is upgraded only after the payment is fetched from Razorpay as captured with the expected amount, or after a signed webhook; each webhook event id is recorded in `WebhookEvent` so duplicates are ignored, and payments are unique by provider reference. Renewal, failure, halt, cancellation and refunds update subscription and payment status. Payment credentials can be stored in the database only in sealed form (AES-256-GCM, key from `SETTINGS_ENCRYPTION_KEY`, bound to the field by HKDF "purpose"), require recent re-authentication to change, and are never returned by any API. This module was verified against a mock Razorpay server only.

## 6.15 Branding and Configuration

Branding (`src/lib/branding.ts`, `src/lib/settings.ts`) supports a draft that can be previewed and then published, a reset to defaults, and assets (logo, dark logo, favicon, social image). Uploaded images are checked by `src/lib/image-check.ts` (magic bytes and dimensions for PNG, JPEG and WebP; a strict reject-list for SVG elements and attributes that could execute script or load external content). Colours are validated as hex values, converted to HSL CSS variables, and checked for contrast; text fields reject markup. General settings include an announcement banner and a switch to close sign-ups.

## 6.16 Error Handling and Validation

- **Validation:** zod schemas on every input; `readJson()` rejects oversized or malformed bodies; type-specific validators for QR content, UPI identifiers, IFSC codes, barcodes, prices and dates.
- **Errors:** domain code throws `ApiError(status, message)`; `handle()` returns a JSON error; unexpected exceptions return a generic message and are logged with redaction.
- **Logging:** `logger` writes JSON lines in production; `logEvent()` also stores entries in the `Log` table shown in the admin console; `audit()` records security events. Neither throws if the database write fails.
- **User-facing pages:** dynamic-link errors render friendly HTML pages with appropriate status codes (404/410) and a link to report abuse; a custom `not-found.tsx` exists.

## 6.17 Important Code Walkthroughs

Table 6.1: Code walkthrough index

| # | Excerpt | File | What it demonstrates |
|---|---|---|---|
| 1 | `POST /api/qrcodes` | `src/app/api/qrcodes/route.ts` | Layered handler: authenticate → rate-limit → validate → service → response |
| 2 | `handle()` | `src/lib/api.ts` | Central error mapping without leaking internals |
| 3 | `load()` | `src/lib/session.ts` | Server-side session validation, idle timeout, MFA flag |
| 4 | `verifyTotp()` | `src/lib/mfa.ts` | RFC 6238 verification with drift window and replay protection |
| 5 | Origin check | `src/middleware.ts` | CSRF defence |
| 6 | `effectiveEcc()` | `src/lib/qr-render.ts` | Automatic error-correction increase for logos |
| 7 | `gs1CheckDigit()`, `lookupKey()` | `src/lib/barcodes.ts` | Standards-based validation and GTIN normalisation |
| 8 | `moveStock()` | `src/lib/products.ts` | Concurrency-safe stock decrement and ledger |
| 9 | `withQuota()` | `src/lib/entitlements.ts` | Serialising quota checks per user |
| 10 | Redirect response | `src/app/r/[code]/route.ts` | Non-cacheable redirect with UTM |
| 11 | Signature verification | `src/lib/razorpay.ts` | HMAC with constant-time comparison |

## 6.18 Database Initialization and Migration

- **Development (SQLite):** `npm run db:push` creates or updates `prisma/dev.db` from the schema. `npm run db:studio` opens Prisma Studio.
- **Production (MySQL):** create a database and a least-privilege user; set `DATABASE_URL`; run `npm run db:mysql:deploy` (`prisma migrate deploy` with the MySQL schema); then `npm run build`.
- **Schema changes:** edit `prisma/schema.prisma`, run `npm run db:mysql:schema` to regenerate the MySQL schema, create a MySQL migration, and run the CI check `npm run db:mysql:schema -- --check`.
- **Data migration:** stop writes, back up, run `npm run db:migrate-data` (dry run first), switch `DATABASE_URL`, smoke-test (procedure in `docs/DATABASE.md`).
- **Plans:** on first use the default plans (Free, Pro, Business) are inserted only if the `PricingPlan` table is empty (`src/lib/plan-store.ts`).

## 6.19 Application Execution Procedure

Table 6.3: Execution commands

| Purpose | Commands |
|---|---|
| Development | `npm run dev` → http://localhost:3000 |
| Production build | `npm run build` (copies WASM, generates Prisma client, builds) |
| Production start | `npm start` (or `next start -p <port>`) behind HTTPS |
| Administrator | `npm run admin -- create --email <e-mail> --super` (password via stdin) |
| Checks | `npm run typecheck`, `npm run lint`, `npm test` |
| Integration tests | build, start against a throw-away DB, then `test:api`, `test:admin`, `test:browser`, `test:billing` (see README) |

## 6.20 Deployment Procedure

**Verified during this audit:** building and running the production server locally (`next build`, `next start`) against a throw-away SQLite database, and applying the MySQL migrations to a MySQL 8.4 server in Docker.

**Recommended (from `docs/DEPLOYMENT.md`; not performed in this audit):**

1. Provision a Linux server with Node.js 22 and a MySQL 8 database; create a least-privilege database user.
2. Set production environment variables (strong random `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `SETTINGS_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL` with https, `TRUST_PROXY`, `RATE_LIMIT_STORE=database`, SMTP).
3. `npm ci`, `npm run db:mysql:deploy`, `npm run build`.
4. Run `npm start` under a process manager (for example systemd or PM2).
5. Put a reverse proxy (nginx or Caddy) in front for TLS and forward `X-Forwarded-*` headers.
6. Point an uptime monitor at `/api/health`; configure log collection and database/upload backups (`docs/BACKUP-RECOVERY.md`).
7. Create the first super administrator and enrol MFA; configure Razorpay webhooks to `{APP_URL}/api/billing/webhook`.
8. **Before deployment, fix D-01** (upload size) and commit the working tree.

## 6.21 User Interface Screenshots

All screenshots below were captured automatically from the **actual running production build** by the project's browser test (`SHOT_DIR`) during the final audit run, using throw-away accounts on an empty database. Workspace pages therefore show an empty account, and the admin pages show a test administrator (e-mail `ui-admin-…@example.com`) with the "2FA not enabled" banner that an ordinary admin without MFA sees. No screenshot was edited. The complete set (47 desktop and 47 mobile images) is in `screenshots/` and indexed in Appendix G.

![Figure 6.1: Landing page (desktop, 1280 px)](screenshots/desktop-1280/home.png)

![Figure 6.2: Sign-in page](screenshots/desktop-1280/login.png)

![Figure 6.3: QR code generator with live preview and scan test](screenshots/desktop-1280/generator.png)

![Figure 6.4: Barcode generator](screenshots/desktop-1280/barcodes.png)

![Figure 6.5: Universal scanner](screenshots/desktop-1280/scanner.png)

![Figure 6.6: Workspace overview dashboard (new account)](screenshots/desktop-1280/dashboard.png)

![Figure 6.7: Products list (new account)](screenshots/desktop-1280/products.png)

![Figure 6.8: New product form](screenshots/desktop-1280/products_new.png)

![Figure 6.9: Inventory](screenshots/desktop-1280/inventory.png)

![Figure 6.10: Bulk generator](screenshots/desktop-1280/bulk.png)

![Figure 6.11: UPI payment QR tool](screenshots/desktop-1280/upi.png)

![Figure 6.12: Pricing page](screenshots/desktop-1280/pricing.png)

![Figure 6.13: Admin console overview](screenshots/desktop-1280/admin.png)

![Figure 6.14: Admin user management](screenshots/desktop-1280/admin_users.png)

![Figure 6.15: Admin branding settings](screenshots/desktop-1280/admin_settings_branding.png)

![Figure 6.16: Admin pricing plans editor](screenshots/desktop-1280/admin_settings_pricing.png)

![Figure 6.17: Admin payment-gateway configuration](screenshots/desktop-1280/admin_settings_payments.png)

![Figure 6.18: Admin security and audit log](screenshots/desktop-1280/admin_security.png)

![Figure 6.19: Mobile views (375 px): landing page, generator and scanner](screenshots/mobile-montage.png)

## 6.22 Evaluation of Implemented Features

Table 6.2: Feature verification matrix

[[FEATURE_MATRIX]]

## 6.23 Evaluation Against Project Objectives

The objectives O1–O10 of Section 1.7 are evaluated in Table 7.1. In brief: objectives O1–O7, O9 and O10 are met with test evidence; O8 (plans and payments) is met for entitlements and verified against a mock payment provider, but not against live Razorpay; and the upload limits that are part of O8's plan model are affected by defect D-01.

## 6.24 Known Limitations

1. **Large uploads (D-01):** files over 10 MB cannot be uploaded even on plans that allow 25–50 MB.
2. **Local file storage:** uploads live on one server's disk; horizontal scaling needs shared or object storage.
3. **No e-mail verification** at sign-up; password reset depends on SMTP being configured.
4. **Rate limiting** defaults to per-process memory; multi-instance deployments must enable the database store and correct proxy settings.
5. **External integrations untested** in this audit (Google, SMTP, live Razorpay).
6. **No performance baseline** and no load testing.
7. **Browser coverage:** automated tests only on Chromium.
8. **Single currency for UPI**; payments only via Razorpay.
9. **Scan history** is per device (browser storage) and is not synchronised to the account.
10. **Admin plan assignment** limited to the three built-in plan ids (D-05).
11. **Repository hygiene:** personal data in Git history (D-07) and a large amount of uncommitted work at audit time.

## 6.25 Maintenance and Operational Considerations

- Keep dependencies current (Dependabot is configured) and review the advisory allowlist before its 2027-01-31 expiry.
- Run the CI workflow on every change; add the audit probes (D-01 regression) to the suites.
- Back up the database and `UPLOAD_DIR` together; test restores (`docs/BACKUP-RECOVERY.md`).
- Rotate secrets carefully: `MFA_ENCRYPTION_KEY` and `SETTINGS_ENCRYPTION_KEY` are needed to decrypt stored secrets.
- Monitor `/api/health`, the system page and security events in the admin console; review the audit log.
- Periodically purge expired sessions, old logs and rate-limit rows (rate-limit rows are cleaned opportunistically; no scheduled job exists for sessions or logs).

## 6.26 Implementation Summary

QRSathi is implemented as a coherent, layered Next.js application in which validation, authorization and business rules live in a small set of server modules shared by all routes. The implementation goes beyond basic CRUD: it uses transactions for consistency, idempotency for payments, encryption for secrets and careful privacy defaults. The audit verified the large majority of features with executed tests and found one significant functional defect (D-01) and several minor issues, all of which are documented for correction.
