# Chapter 4: System Design

## 4.1 Introduction to System Design

System design translates the requirements of Chapter 3 into a structure of components, data and interactions. This chapter presents QRSathi's design at several levels: the overall architecture (Sections 4.2–4.5), behavioural models — use cases, data-flow diagrams, flowcharts and sequence diagrams (Sections 4.6–4.8 and 4.12), the database design (Sections 4.9–4.10), structural UML views (Sections 4.11, 4.13, 4.14), and the user-interface, API and security design (Sections 4.15–4.17). All diagrams were drawn from the audited source code; their editable Mermaid [29] sources are in `docs/mini-project-report/diagrams/`, and PlantUML equivalents are provided for the use-case, deployment and login-sequence diagrams.

## 4.2 System Architecture

QRSathi is a **layered monolithic web application** built on Next.js. One deployable unit contains the user interface, the HTTP API and the business logic; data is held in one relational database and one directory of uploaded files.

Table 4.1: Architectural layers

| Layer | Responsibility | Main locations |
|---|---|---|
| Presentation (client) | Interactive tools: QR workbench, barcode generator, scanner, product editor, admin views; SVG rendering; export; camera decoding | `src/components/**`, client components in `src/app/**` |
| Presentation (server) | Server-rendered pages and layouts, page guards, metadata | `src/app/**/page.tsx`, `layout.tsx`, `src/lib/guard.ts` |
| Edge of the API | CSRF origin check for state-changing API calls; request path header for admin redirects | `src/middleware.ts` |
| API | Route handlers: parse and validate input, authenticate, call domain services, map errors to HTTP | `src/app/api/**/route.ts`, `src/lib/api.ts` |
| Domain services | QR, products, barcodes, entitlements, billing, scans, branding, settings | `src/lib/*.ts` |
| Cross-cutting | Sessions/RBAC, rate limiting, audit, logging, redaction, encryption, configuration checks | `src/lib/session.ts`, `rate-limit.ts`, `audit.ts`, `logger.ts`, `redact.ts`, `mfa.ts`, `secret-box.ts`, `env-check.ts` |
| Data access | Prisma Client singleton | `src/lib/db.ts` |
| Persistence | SQLite or MySQL; local file storage | `prisma/`, `src/lib/storage.ts` |

An important characteristic is that several modules are **isomorphic**: the QR type registry (`qr-types.ts`), the QR renderer (`qr-render.ts`), the barcode module (`barcodes.ts`), the plan schema (`plans.ts`) and branding helpers run in both the browser and the server. The same zod schema that shows an error message in the form is used again by the API to reject invalid data, so the client cannot bypass validation.

## 4.3 Architectural Style and Rationale

The architecture combines three styles, as supported by the Next.js App Router [1]:

1. **Client–server with server-side rendering.** Next.js renders pages on the server (React Server Components) and hydrates interactive parts in the browser.
2. **Layered architecture.** Route handlers depend on services, services depend on the data-access layer; there are no calls in the opposite direction. This keeps HTTP concerns (status codes, cookies) out of the domain logic and makes the logic reusable from scripts (the admin CLI and the tests import `src/lib` modules directly).
3. **Client-heavy processing for media.** Rendering QR/barcode images and decoding camera frames happen in the browser. This removes server load for the most frequent operations and keeps scanned images on the user's device.

The main alternative considered implicitly by this design — a separate single-page application and REST back-end, or microservices — would add deployment complexity without benefit at the project's scale. The trade-offs are discussed in Section 4.18.

## 4.4 High-Level System Architecture Diagram

![Figure 4.1: High-level system architecture of QRSathi](diagrams/rendered/system-architecture.png)

Figure 4.1 shows the verified components. The browser runs React client components, the zxing-wasm scanner and the QR/barcode renderers. All requests reach the Next.js server; for `/api` routes, the middleware first enforces the CSRF origin rule. App Router pages and API route handlers authenticate through the session/RBAC module and call domain services, which use cross-cutting services (rate limiting, audit, redaction, logging) and access the database through Prisma. SQLite is used in development; MySQL is the production target (dashed line, because no production deployment was verified). Public routes (`/r`, `/p`, `/f`, `/brand`) serve redirects, hosted pages, uploaded files and brand images. External services are optional: Razorpay (REST calls and signed webhooks), Google OAuth and SMTP.

## 4.5 Module Decomposition

Table 4.2: Module decomposition

| Module | Responsibilities | Inputs | Outputs | Depends on |
|---|---|---|---|---|
| Authentication & sessions | Sign-up, sign-in, Google OAuth, reset, sessions, logout | Credentials, cookies | Session cookie, user DTO | Prisma, bcrypt, jose, rate limit, audit |
| Authorization (RBAC) | Roles, page and API guards, admin permission rules, recent-auth | Session, role | Allow / 401 / 403 / redirect | Sessions |
| Admin auth & MFA | Admin login, TOTP, recovery codes, re-authentication | Password, TOTP, ticket | `qs_admin` session | Node crypto, Prisma |
| QR types & rendering | 27 type definitions, payload builders, SVG renderer, design warnings | Form data, design | Payload text, SVG | qrcode, zod |
| QR service | Persist, update, duplicate QR codes; short codes; UTM | Validated input | `QrCode` rows | Entitlements, Prisma |
| Dynamic resolution & scans | `/r/[code]`, `/p/[code]`, scan recording | Short code, request headers | 302 / page / 410; `Scan` rows | Prisma, rate limit, UA parser |
| Analytics | Aggregate scans; CSV export | Date range | Chart data, CSV | Prisma, entitlements |
| Barcodes | 23 formats: validation, check digits, GS1 parsing, rendering, labels, lookup keys | Format, value | SVG, normalised value | bwip-js |
| Scanner | Camera/image decoding, classification, safety notes, history | Video frames, images | Decoded results | zxing-wasm, content safety |
| Products & inventory | Product CRUD, barcodes, stock movements, lookup, import | Product data, movements | Products, ledger entries | Barcodes, entitlements, Prisma |
| Bulk | Batch generation, CSV/XLSX parsing and export | Spreadsheet rows | ZIP/PDF of codes, import report | papaparse, read/write-excel-file, jszip, jspdf |
| Uploads | Validate and store files; serve safely | Multipart file | `Upload` row, `/f/{name}` | Storage, entitlements |
| Plans & entitlements | Plan catalogue (DB with defaults), quota checks, feature flags | User plan | Allow / 403 | Prisma |
| Billing | Provider plan sync, subscriptions, checkout verification, webhooks, refunds, cancellation | Plan id, Razorpay payloads | Subscription/Payment rows, plan changes | Razorpay client, payment config |
| Configuration & branding | Settings, branding draft/publish, assets, theme CSS | Admin input, images | `Setting`/`BrandAsset` rows | image-check, Prisma |
| Payment configuration | Store sealed credentials, verify, enable checkout | Keys, mode | Status (never secrets) | secret-box, Razorpay |
| Audit & logging | Audit events, system log, structured logs | Events | `AuditLog`, `Log`, stdout | redact |
| Admin console | Dashboards for users, codes, reports, products, analytics, subscriptions, payments, security, settings, system | Admin requests | Views | All of the above |

## 4.6 Use-Case Diagram

![Figure 4.2: Use-case diagram (actors and principal use cases)](diagrams/rendered/use-case-diagram.png)

Figure 4.2 shows five actors. The *Visitor* (no account) opens dynamic links and hosted pages, reports abusive codes and can use the scanner. The *Registered user* performs the workspace use cases UC1–UC11. The *Admin* moderates and configures (UC14, UC15, UC18); the *Super admin* additionally manages pricing and privileged settings (UC16, UC17) — in UML terms the super admin specialises the admin (shown explicitly in the PlantUML source `use-case-diagram.puml`). *Razorpay* is a system actor that delivers payment events (UC19), which the subscription use case includes. The diagram is drawn with Mermaid flowchart shapes: circles are actors and rounded boxes are use cases inside the system boundary.

## 4.7 Data-Flow Diagrams

### 4.7.1 Context-Level DFD (Level 0)

![Figure 4.3: Context-level data-flow diagram (Level 0)](diagrams/rendered/context-dfd.png)

At the context level (Figure 4.3) QRSathi is a single process exchanging data with six external entities. Users send credentials, QR content, products, stock movements and uploads, and receive images, analytics and billing status. Visitors send short-code requests and abuse reports and receive redirects, hosted pages and files. Administrators send moderation and configuration actions and receive reports and audit data. Razorpay, Google and the SMTP server exchange the data shown on the arrows.

### 4.7.2 Level-1 DFD

![Figure 4.4: Level-1 data-flow diagram](diagrams/rendered/level-1-dfd.png)

Figure 4.4 decomposes the system into six processes and six data stores. Process 1.0 authenticates users against D1 (users, sessions, recovery codes) and writes audit events to D6. Process 2.0 creates QR codes in D2 after reading plan limits from D5. Process 3.0 serves visitors: it reads D2 and appends to D3 (scans). Process 4.0 maintains D4 (products, barcodes and the inventory ledger). Process 5.0 exchanges subscription and payment data with Razorpay and D5, and upgrades the user's plan in D1. Process 6.0, administration, reads and writes most stores.

### 4.7.3 Level-2 DFD: QR Creation and Dynamic Resolution

![Figure 4.5: Level-2 DFD: QR code creation and dynamic resolution (processes 2.0 and 3.0)](diagrams/rendered/level-2-dfd-qr.png)

Figure 4.5 refines processes 2.0 and 3.0. Creation (2.1–2.5) validates the content against the type schema, decides whether the code is static, dynamic or hosted, allocates a short code or alias for dynamic codes, checks quotas inside a transaction that locks the user's `quotaLock` row, and stores the code. Resolution (3.1–3.4) looks up the short code, checks status, owner and expiry, records the scan with privacy filters, appends UTM parameters and redirects.

## 4.8 Flowcharts

### 4.8.1 User Registration and Login

![Figure 4.6: Flowchart: user registration and login](diagrams/rendered/registration-login-flowchart.png)

Figure 4.6 shows both paths. Registration is rate-limited, validated, checks whether sign-ups are open and whether the e-mail exists, then hashes the password and forces the role to `user`. Login applies three rate limits, performs a dummy bcrypt comparison for unknown accounts (so response time does not reveal whether an account exists), returns one generic error for all credential failures, and blocks suspended accounts. Both paths end by creating a server-side session.

### 4.8.2 Authentication and Authorization of a Request

![Figure 4.7(a): Request authorization — CSRF check and workspace guard](diagrams/rendered/authorization-flowchart-a.png)

![Figure 4.7(b): Request authorization — administrator guard](diagrams/rendered/authorization-flowchart-b.png)

Every request passes the checks in Figure 4.7 (parts a and b). The middleware rejects cross-origin state-changing API calls (except the webhook, which is authenticated by signature). Workspace handlers call `requireUser()`, which verifies the signed cookie, the session row, the account status and the `sessionVersion`; resource ownership is then checked, and resources of other users produce 404 (not 403) to avoid revealing their existence. Admin handlers call `requireAdmin()`, which additionally enforces the admin role, a two-hour idle timeout, MFA verification of the session, mandatory MFA for super administrators, super-admin-only endpoints and — for payment credentials — re-authentication within 15 minutes.

### 4.8.3 QR Code Generation

![Figure 4.8(a): QR generation in the browser](diagrams/rendered/qr-generation-flowchart-a.png)

![Figure 4.8(b): Saving a QR code on the server](diagrams/rendered/qr-generation-flowchart-b.png)

Figure 4.8 shows that generation and export are fully client-side; the server is involved only when a signed-in user saves the code. Server-side validation is repeated before the quota check and insert.

### 4.8.4 Barcode Generation and Scanning

![Figure 4.9(a): Barcode generation](diagrams/rendered/barcode-flowchart-a.png)

![Figure 4.9(b): Barcode and QR scanning](diagrams/rendered/barcode-flowchart-b.png)

Figure 4.9 has two branches. Generation validates the value for the chosen symbology before rendering with bwip-js and optionally composing a label. Scanning decodes in the browser, classifies the result, runs safety heuristics, stores the entry in the device's local history and — only for signed-in users — performs a read-only product lookup.

### 4.8.5 Product and Inventory Workflow

![Figure 4.10(a): Product creation](diagrams/rendered/product-inventory-flowchart-a.png)

![Figure 4.10(b): Stock movement](diagrams/rendered/product-inventory-flowchart-b.png)

Figure 4.10 shows that a product is created only after field validation, barcode validation, uniqueness checks and quota checks. Stock then changes exclusively through movements; a stock-out uses a conditional update (`stock >= quantity`) so concurrent requests cannot drive stock negative. Every movement appends a ledger entry.

### 4.8.6 Dynamic QR Resolution

![Figure 4.11(a): Dynamic QR resolution — status checks](diagrams/rendered/dynamic-qr-resolution-flowchart-a.png)

![Figure 4.11(b): Dynamic QR resolution — scan recording and redirect](diagrams/rendered/dynamic-qr-resolution-flowchart-b.png)

Figure 4.11 shows the order of checks in `src/app/r/[code]/route.ts`. Visitors are always served (redirected or shown an explanatory page); bots, rate-limited clients and privacy signals only affect what is *recorded*.

### 4.8.7 Subscription and Payment Workflow

![Figure 4.12(a): Subscription checkout — starting checkout](diagrams/rendered/subscription-payment-flowchart-a.png)

![Figure 4.12(b): Subscription checkout — confirmation and webhook](diagrams/rendered/subscription-payment-flowchart-b.png)

Figure 4.12 shows that the client never supplies a price: it sends a plan identifier and interval, and the server looks up the amount and the active provider plan. The plan is upgraded only after verification of the checkout signature *and* an API fetch showing a captured payment of the right amount, or after a signed webhook. Duplicate webhook deliveries are detected through the `WebhookEvent` ledger.

### 4.8.8 Administrator Configuration Workflow

![Figure 4.13: Flowchart: administrator configuration workflow](diagrams/rendered/admin-config-flowchart.png)

Figure 4.13 shows the admin sign-in (with MFA), the separation between settings any admin may change and super-admin-only settings, the re-authentication requirement for payment credentials, sealing of secrets with AES-256-GCM and the audit entry written for each change.

## 4.9 Database Design

### 4.9.1 Conceptual Data Model

![Figure 4.14: Conceptual data model (entity groups)](diagrams/rendered/conceptual-model.png)

The conceptual model (Figure 4.14) groups the 22 entities into five areas: identity and security; QR codes and analytics; products and inventory; billing; and configuration and logs. The `User` entity is the hub: almost all business data is owned by a user, which implements multi-tenancy at the row level.

### 4.9.2 Entity-Relationship Diagrams

![Figure 4.15: Entity-relationship overview (15 related models; 7 standalone models listed in Table 4.6)](diagrams/rendered/database-erd.png)

Figure 4.15 shows all foreign-key relationships. Crow's-foot notation is used: `||--o{` means "exactly one to zero or more" and `|o--o{` "zero or one to zero or more" (an optional foreign key). The detailed ERDs below include the main attributes of each entity.

![Figure 4.16: ERD detail: accounts, sessions, QR codes and analytics](diagrams/rendered/erd-accounts-qr.png)

![Figure 4.17: ERD detail: products, barcodes and inventory ledger](diagrams/rendered/erd-inventory.png)

![Figure 4.18: ERD detail: pricing plans, subscriptions and payments](diagrams/rendered/erd-billing.png)

Figures 4.16–4.18 were checked field by field against `prisma/schema.prisma`. Note that `Subscription.planId` and `Payment.plan` are deliberately *snapshots* without a foreign key to `PricingPlan`, so that later plan edits or archiving never rewrite payment history.

### 4.9.3 Logical Design: Entities and Relationships

Table 4.3: Relationships and cardinalities

| Parent | Child | Cardinality | Foreign key | On delete |
|---|---|---|---|---|
| User | Session, MfaRecoveryCode, PasswordReset | 1 : N | `userId` | Cascade |
| User | QrCode, Download, Upload | 1 : N | `userId` | Cascade |
| User | Product, Barcode, InventoryTransaction | 1 : N | `userId` | Cascade |
| User | Subscription, Payment | 1 : N | `userId` | Cascade |
| QrCode | Scan | 1 : N | `qrId` | Cascade |
| QrCode | Download | 0..1 : N | `qrId` (nullable) | Set null |
| Product | Barcode, InventoryTransaction | 1 : N | `productId` | Cascade |
| Subscription | Payment | 0..1 : N | `subscriptionId` (nullable) | Set null |
| PricingPlan | ProviderPlan | 1 : N | `planId` | Restrict |

### 4.9.4 Physical Design

The canonical schema is `prisma/schema.prisma` (SQLite provider) managed with Prisma ORM [5]. The MySQL schema `prisma/mysql/schema.prisma` is *generated* from it by `scripts/db/mysql-schema.mjs`, which adds MySQL column types (`TEXT`, `MEDIUMTEXT`, `VARCHAR(n)`) for long strings and `relationMode = "foreignKeys"`. MySQL has two versioned migrations: `20261025000000_init` and `20261025180000_billing_branding`. SQLite development databases are synchronised with `prisma db push` and have no migration history. Primary keys are CUID strings generated by Prisma (`@default(cuid())`), except `PricingPlan.id` (a readable plan identifier such as `pro`), `Setting.key` and `RateLimit.key`. Money is stored as integers in minor units. JSON documents (QR content and design, UTM, plan features and limits, audit details) are stored as text and validated by zod in the application.

Table 4.4: Physical model summary (generated from `prisma/schema.prisma`)

[[MODEL_SUMMARY]]

### 4.9.5 Indexes and Constraints

Table 4.5: Unique constraints and indexes, and their purpose

| Model | Constraint / index | Purpose |
|---|---|---|
| User | `email` UNIQUE; `googleId` UNIQUE | One account per e-mail; link Google identity |
| QrCode | `shortCode` UNIQUE; index `userId` | Global short-link namespace; list a user's codes |
| Scan | index (`qrId`, `createdAt`) | Time-range analytics per code |
| Download | index (`userId`, `createdAt`) | Download history |
| Upload | `storedName` UNIQUE | Serve file by random name |
| Product | UNIQUE (`userId`, `sku`); index (`userId`, `status`); index (`userId`, `category`) | Per-user SKU uniqueness; filtered lists |
| Barcode | UNIQUE (`userId`, `format`, `value`); index (`userId`, `lookupKey`); index `productId` | Per-user barcode uniqueness; scan lookup |
| InventoryTransaction | index (`productId`, `createdAt`); index (`userId`, `createdAt`) | Product history; user activity |
| Payment | `providerRef` UNIQUE; index (`userId`, `createdAt`); index `subscriptionId` | Idempotent payment recording |
| Subscription | `providerSubscriptionId` UNIQUE; index (`userId`, `status`) | Map provider events; find live subscription |
| ProviderPlan | `providerPlanId` UNIQUE; index (`planId`, `interval`, `mode`, `active`) | Find active provider plan for checkout |
| WebhookEvent | UNIQUE (`provider`, `eventId`); index `receivedAt` | Duplicate delivery detection |
| Session | index `userId`; index `expiresAt` | Revoke all sessions; clean-up |
| MfaRecoveryCode | `codeHash` UNIQUE; index `userId` | One-time code lookup |
| PasswordReset | `tokenHash` UNIQUE | Token lookup by hash |
| AuditLog | index `createdAt`; `action`; `actorId` | Filter audit log |
| BrandAsset | `storedName` UNIQUE; index (`kind`, `createdAt`) | Serve and list assets |
| Log, RateLimit | index `createdAt` / `resetAt` | Pagination; expiry clean-up |

### 4.9.6 Standalone Models

Table 4.6: Models without foreign-key relationships

| Model | Role | Why standalone |
|---|---|---|
| AbuseReport | Reports from visitors about a short code or URL | Reporter is anonymous; reported code may be deleted later |
| WebhookEvent | Ledger of processed provider events | Exists before any matching subscription may be found |
| BrandAsset | Uploaded logos, favicon, social image | Site-level, not user-owned; `createdBy` stores the admin id as text |
| Log | System log shown in the console | Must survive user deletion; `userId` kept as plain text |
| Setting | Key–value site settings (including sealed credentials and branding JSON) | Global configuration |
| AuditLog | Security and admin events | Must survive deletion of the actor; `actorId` kept as plain text |
| RateLimit | Fixed-window counters (database store) | Keyed by arbitrary strings |

### 4.9.7 Enumerated and Status Fields

Status fields are stored as strings (SQLite has no native enum type); permitted values are enforced by zod schemas and code.

Table 4.7: Enumerated fields

| Field | Values |
|---|---|
| `User.role` | `user`, `admin`, `super_admin` |
| `User.status` | `active`, `suspended` |
| `User.plan` | Plan identifier, default `free` (defaults: `free`, `pro`, `business`) |
| `Session.kind` | `user`, `admin` |
| `QrCode.status` | `active`, `paused`, `disabled` (admin only) |
| `Scan.device` | `mobile`, `tablet`, `desktop`, `bot`, `unknown` |
| `Product.status` | `active`, `archived` |
| `Barcode.source` | `internal`, `assigned`, `existing` |
| `InventoryTransaction.type` | `created`, `in`, `out`, `adjust`, `updated`, `archived`, `restored`, `imported` |
| `AbuseReport.status` | `open`, `resolved`, `dismissed` |
| `Payment.status` | `created`, `pending`, `paid`, `failed`, `expired`, `refunded`, `partially_refunded` |
| `Subscription.status` | `created`, `authenticated`, `active`, `pending`, `halted`, `cancelled`, `completed`, `expired` |
| `PricingPlan.status` | `draft`, `published`, `archived` |
| `ProviderPlan.mode` / `Subscription.mode` | `test`, `live` |
| `WebhookEvent.status` | `processed`, `ignored`, `rejected` |

### 4.9.8 Audit-Related Fields

Most tables carry `createdAt` (and mutable ones `updatedAt`, maintained by Prisma). Security-relevant history is kept in `AuditLog` (actor, action, target, redacted JSON details, hashed IP), `Log`, `InventoryTransaction` (business audit of stock), `Session.lastSeenAt`/`reauthAt`, `User.lastLoginAt`, and `WebhookEvent`. The full table-by-table data dictionary is in Appendix C.

## 4.10 Database Normalization

The schema was assessed against the normal forms using the actual columns:

Table 4.8: Normalization assessment

| Normal form | Assessment |
|---|---|
| First normal form (1NF) | Each column holds a single value **at the database level**, and each table has a primary key. However, several columns store JSON documents (`QrCode.content`, `QrCode.design`, `QrCode.utm`, `PricingPlan.features`, `PricingPlan.limits`, `AuditLog.details`, branding in `Setting.value`). The database treats them as opaque strings; they are never queried by their internal fields. Strictly, these are non-atomic attributes; the design accepts this to store type-specific, schema-less data that is always read and written as a whole. |
| Second normal form (2NF) | All primary keys are single-column surrogate keys (or a single natural key), so no partial dependency on part of a composite key can exist. 2NF holds for every table. |
| Third normal form (3NF) | Non-key attributes depend on the key. Deliberate exceptions are **snapshots** for history: `Payment.plan`, `planName`, `interval`, `amount` and `Subscription.planName`, `amount` copy plan data at the time of payment so history does not change when a plan is edited. `InventoryTransaction.balance` is a derived value stored for an immutable ledger. `Product.stock` is redundant with the sum of ledger quantities, kept for fast reads and protected by atomic updates. `Barcode.userId` duplicates `Product.userId` so that uniqueness can be enforced per user by a database constraint. |
| BCNF | Candidate keys in tables with composite unique constraints (`Product(userId, sku)`, `Barcode(userId, format, value)`, `WebhookEvent(provider, eventId)`) determine the remaining attributes, and no other non-trivial functional dependencies were found; apart from the intentional redundancies listed above, the design is consistent with BCNF. |

In summary, the schema is normalised to 3NF for its relational data, with documented, intentional denormalisation for history snapshots, ledger balances and per-tenant constraints, and with JSON columns for flexible documents.

## 4.11 Class Diagram

![Figure 4.19: Class diagram: domain entities and server-side service modules](diagrams/rendered/class-diagram.png)

QRSathi is written in a functional TypeScript style: the server-side "classes" are ES modules exporting functions, and database entities are Prisma-generated types. Figure 4.19 therefore uses two stereotypes. `<<entity>>` classes are Prisma models (only key attributes are shown). `<<module ...>>` classes are server modules with their main exported functions. Solid arrows with multiplicities are associations between entities; dashed arrows are "uses" dependencies of modules. The only true TypeScript classes in the server code are small error types (`ApiError`, `RazorpayError`), which are omitted.

## 4.12 Sequence Diagrams

![Figure 4.20: Sequence diagram: workspace login and administrator MFA login](diagrams/rendered/login-sequence.png)

Figure 4.20 traces a login through the middleware, the login route, the shared credential check and the database. The `alt` fragments show the generic failure path and the two success paths: a workspace session, or — for an MFA-enabled administrator — a short-lived ticket followed by TOTP verification with an atomic replay guard.

![Figure 4.21: Sequence diagram: saving a dynamic QR code](diagrams/rendered/qr-generation-sequence.png)

Figure 4.21 shows client-side rendering followed by the save request. Note the transaction in `withQuota`: the first statement increments `User.quotaLock`, which takes a row lock in MySQL (or the write lock in SQLite) so that two concurrent saves by the same user are serialised and cannot both pass the limit check.

![Figure 4.22: Sequence diagram: database-backed product creation](diagrams/rendered/product-create-sequence.png)

Figure 4.22 shows validation, barcode normalisation, uniqueness checks and the nested insert of a product with its barcodes and first ledger entry in one transaction.

![Figure 4.23: Sequence diagram: super administrator saves payment-gateway credentials](diagrams/rendered/admin-config-sequence.png)

Figure 4.23 shows the re-authentication loop, sealing of secrets, audit logging of field *names* only, and a read-only verification call to Razorpay that creates nothing.

![Figure 4.24: Sequence diagram: subscription checkout, verification and webhook](diagrams/rendered/payment-sequence.png)

Figure 4.24 shows the two independent confirmation paths (client callback with server verification, and the signed webhook) and how idempotency prevents a payment from being applied twice.

## 4.13 Component Diagram

![Figure 4.25: Component diagram](diagrams/rendered/component-diagram.png)

Figure 4.25 groups the code into presentation components, isomorphic libraries shared by client and server, and server-only libraries. Presentation components call the server only through `fetch` to API routes; they never import server modules. Isomorphic libraries contain no React or database imports, which allows the same validation and rendering code to run on both sides.

## 4.14 Deployment Diagram

![Figure 4.26: Deployment diagram: verified development set-up and recommended production topology](diagrams/rendered/deployment-diagram.png)

Figure 4.26 distinguishes what was verified from what is recommended. **Verified:** the development set-up (Node.js 22, `next dev`, SQLite file, local uploads) and the isolated production build used for testing (`next start` on port 3100 with a throw-away SQLite database), and the CI workflow definition. **Recommended (not deployed or verified in this audit):** a reverse proxy terminating TLS in front of one or more `next start` processes, a MySQL 8 server with a least-privilege user, and a persistent volume for uploads, as described in `docs/DEPLOYMENT.md`.

## 4.15 UI/UX Design

**Navigation.** The workspace uses a sidebar with four groups defined in `src/components/nav-config.ts`: *Workspace* (Overview, QR Generator, Barcode Generator, Universal Scanner, Scan History), *Business* (Products, Inventory, Bulk Generator, Analytics), *More tools* (My QR Codes, Dynamic QR, UPI Payment QR, Design Studio, Plans & Pricing; collapsed by default) and *Account* (Settings, Help & Support). A command palette offers keyword search across these destinations. The public site has marketing pages (home, features, tools, pricing, about, contact, help, privacy, terms, report). The admin console has its own shell and navigation (`src/components/admin/admin-nav.ts`) and never shows workspace navigation (verified by the admin test suite).

Table 4.9: Principal pages

| Area | Routes |
|---|---|
| Public site | `/`, `/features`, `/tools`, `/pricing`, `/about`, `/contact`, `/help`, `/privacy`, `/terms`, `/report` |
| Authentication | `/login`, `/signup`, `/forgot-password`, `/reset-password` |
| Workspace | `/dashboard`, `/generator`, `/barcodes`, `/scanner`, `/scan-history`, `/codes`, `/dynamic`, `/upi`, `/studio`, `/bulk`, `/analytics`, `/analytics/[id]`, `/products`, `/products/new`, `/products/[id]`, `/inventory`, `/billing/status`, `/dashboard/settings`, `/dashboard/history` |
| Public QR endpoints | `/r/[code]` (redirect), `/p/[code]` (hosted page), `/f/[name]` (file), `/brand/[name]` (brand image) |
| Admin console | `/admin` (overview), `/admin/users`, `/admin/qr-codes`, `/admin/reports`, `/admin/products`, `/admin/barcodes`, `/admin/inventory`, `/admin/analytics`, `/admin/subscriptions`, `/admin/payments`, `/admin/security` (+ `/admins`, `/events`), `/admin/settings` (+ `/branding`, `/appearance`, `/email`, `/pricing`, `/payments`), `/admin/system`, `/admin/mfa`, `/admin/login`, `/admin/forgot-password` |

**Design principles.** The interface uses a consistent component library (`src/components/ui.tsx`), clear empty states, inline validation messages from the shared zod schemas, warnings before risky actions (for example, "archive before delete"), and toast notifications for outcomes.

**Responsiveness.** Layouts use Tailwind responsive utilities. The automated browser suite loads every public and workspace page at 375, 768 and 1280 px and fails if the page scrolls horizontally; all such checks passed for public and workspace pages in the final audit run.

**Accessibility.** At 1280 px the browser suite checks that every control, link and image has an accessible name. A "Skip to content" link is present in the admin shell. No manual audit against WCAG 2.2 [20] was performed.

**Themes and branding.** Users can choose light, dark or system themes (stored in `localStorage`). Administrators can change brand colours, which are converted into CSS variables (`themeCss()` in `src/lib/branding.ts`), and the editor checks colour contrast.

## 4.16 API Design

The API follows a resource-oriented JSON-over-HTTP design implemented with Next.js route handlers. There are 64 API route modules with 89 method handlers (full inventory in Appendix B and `QRSathi_API_Documentation.md`).

**Conventions.**

- Requests and responses are JSON (`Content-Type: application/json`), except file uploads (multipart), the CSV export, the webhook (raw text) and public HTML routes.
- Every handler is wrapped in `handle()` (`src/lib/api.ts`), which converts an `ApiError(status, message)` into `{ "error": message, "details"?: … }` with that status, and any other exception into a generic 500 message while logging the details server-side. Responses carry `Cache-Control: no-store`.
- Input is parsed by `readJson(req, schema, maxBytes)`, which enforces a body-size limit, rejects malformed JSON with 400 and returns the first zod validation message.
- Resources of other users return 404.

Table 4.10: HTTP status codes used by the API

| Status | Meaning in QRSathi |
|---|---|
| 200 / 201 | Success / resource created |
| 400 | Invalid input or business-rule violation (e.g. not enough stock) |
| 401 | Not signed in, or credentials/MFA code invalid |
| 403 | Signed in but not allowed (role, plan limit, MFA required, re-authentication required, cross-site request) |
| 404 | Not found or not owned |
| 409 | Conflict (duplicate e-mail, SKU, barcode, alias; existing subscription) |
| 410 | Dynamic QR paused, disabled or expired (HTML page) |
| 413 / 415 | Body too large / unsupported or mismatched file type |
| 429 | Rate limit exceeded |
| 500 / 502 / 503 | Unexpected error / payment provider error / payments or webhook not configured |

**Example.** Creating a product:

```http
POST /api/products
Cookie: qs_session=<signed token>
Origin: https://app.example.com
Content-Type: application/json

{"name":"Masala Chai 250g","sku":"CHAI-250","price":"149.00","stock":10,
 "barcodes":[{"format":"ean13","value":"2001234567893","source":"internal"}]}

201 Created
{"item":{"id":"…","sku":"CHAI-250","price":"149.00","priceMinor":14900,"stock":10,
 "lowStock":false,"barcodes":[{"format":"ean13","value":"2001234567893","isPrimary":true,…}],…}}
```

## 4.17 Security Design

The controls below map to common guidance such as the OWASP Cheat Sheet Series [16], OWASP Top 10 [17] and NIST SP 800-63B [18].

Table 4.11: Security controls present in the implementation

| Concern | Control | Location |
|---|---|---|
| Password storage | bcrypt, cost 12; dummy hash for unknown accounts | `src/lib/auth-helpers.ts` |
| Sessions | Server-side `Session` rows referenced by HS256-signed JWT [15], HttpOnly cookies; new id on every login; `sessionVersion` invalidates all tokens on password change, suspension or role change | `src/lib/session.ts` |
| Admin separation | Separate `qs_admin` cookie (SameSite=Strict, 12 h, 2 h idle); workspace session never grants admin access | `src/lib/session.ts` |
| MFA | RFC 6238 TOTP [12], [13], ±1 step, replay guard via `mfaLastStep`; 10 single-use recovery codes stored as SHA-256 hashes; secrets AES-256-GCM encrypted | `src/lib/mfa.ts` |
| Re-authentication | Payment credentials require password (+TOTP) within 15 minutes | `requireRecentAdminAuth()` |
| Authorization | Deny-by-default guards; ownership checks; admin permission rules; last-super-admin protection | `session.ts`, `guard.ts`, `admin-users.ts` |
| CSRF | Origin check for non-GET API requests; SameSite cookies | `src/middleware.ts` |
| Brute force / abuse | Fixed-window rate limits per IP, per account and global; scan recording cap | `src/lib/rate-limit.ts` |
| Input validation | zod schemas; body-size limits; type-specific validation for QR content and barcodes | `src/lib/api.ts`, `qr-types.ts`, `products.ts` |
| SQL injection | All queries through Prisma's parameterised API; no raw SQL in application code | `src/lib/**` |
| XSS | React escaping; branding/settings validation rejects markup; JSON-LD escaping; CSP | `branding.ts`, `next.config.mjs` |
| Uploads | Extension allow-list, magic-byte check, random names, stored outside `public/`, served with `nosniff`, attachment disposition for Office files and a sandboxing CSP | `storage.ts`, `app/f/[name]/route.ts` |
| Branding images | Header parsing for PNG/JPEG/WebP dimensions; SVG reject-list for scripts and external references | `src/lib/image-check.ts` |
| Open redirects | `safeNextPath()` allows only same-origin relative paths | `src/lib/safe-redirect.ts` |
| Secrets | Server-only environment variables; startup check rejects secrets in `NEXT_PUBLIC_*`; payment credentials sealed with a key not stored in the database; status APIs never return secrets | `env-check.ts`, `secret-box.ts`, `payment-config.ts` |
| Payments | HMAC-SHA256 checkout and webhook signatures with constant-time comparison; amounts from the database; API re-fetch; idempotent ledger | `razorpay.ts`, `billing.ts` |
| Privacy | Salted, truncated IP hashes; no raw IPs; DNT/GPC respected; log redaction of e-mails and tokens | `audit.ts`, `scans.ts`, `redact.ts` |
| Headers | CSP [19], X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, HSTS (HTTPS) | `next.config.mjs` |
| Fail-closed configuration | Production server exits on unsafe configuration | `src/instrumentation.ts` |

Table 4.12: Security gaps identified by the audit

| ID | Gap | Severity |
|---|---|---|
| S-01 | A SQLite backup containing user records and bcrypt hashes is present in Git history (commit `21277e0`) | High (if the repository is or becomes public) |
| S-02 | Sandboxing CSP for `/f/*` and `/brand/*` was overridden by the global CSP in the first audited build; a fix exists in the working tree and was re-tested (Chapter 5) | Medium |
| S-03 | E-mail addresses are not verified at sign-up | Low–Medium |
| S-04 | MFA mandatory only for super administrators | Medium |
| S-05 | CSP allows `'unsafe-inline'` scripts | Low–Medium |
| S-06 | No breached-password check | Low |
| S-07 | In-memory rate limiting by default; IP-based limits are spoofable without `TRUST_PROXY` | Medium (deployment-dependent) |
| S-08 | Dynamic QR destinations are not checked against URL reputation services | Medium |
| S-09 | Uploaded files are publicly readable by anyone who knows the random 128-bit name (by design, for File QR codes) | Low |
| S-10 | Dependency advisories accepted until 2027-01-31 (postcss, deepmerge-ts) | Low–Medium |

## 4.18 Design Decisions and Trade-offs

Table 4.13: Design decisions

| Decision | Rationale | Trade-off / alternative |
|---|---|---|
| Next.js full-stack monolith | One language, one deployment, server rendering and API together | Less independent scaling than separate services |
| TypeScript + zod shared schemas | Same validation on client and server; compile-time safety | Build step; schema code duplication avoided but schemas grow large (`qr-types.ts` ≈ 800 lines) |
| Prisma ORM | Type-safe queries, migrations, multi-database support | Some database features (native enums, JSON queries) unused to stay portable |
| SQLite for development, MySQL for production | Zero-setup local development; robust production database | Two providers must be kept compatible; solved by a generated schema and a CI check |
| Server-side sessions instead of stateless JWT | Immediate revocation on logout, password change, suspension | One database read per request (mitigated by per-request caching) |
| Client-side rendering and decoding of codes | No server cost; privacy for scanned images; works with any data | Depends on browser capabilities (WebAssembly, camera) |
| JSON text columns for QR content/design and plan limits | Each QR type has different fields; plans are editable without migrations | Not queryable by SQL; validated in the application |
| Snapshots in payments/subscriptions | History remains correct after plan edits | Denormalised data |
| Local-disk uploads | Simple, no external dependency | Not suitable for multiple servers without shared storage |
| Fixed-window rate limiter with memory/database stores | Simple and dependency-free | Bursts at window edges; memory store per process |
| Razorpay Subscriptions | Indian payment methods and recurring billing | Provider lock-in; only one provider implemented |
