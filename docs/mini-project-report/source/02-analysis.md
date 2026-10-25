# Chapter 2: System Analysis

## 2.1 Introduction to System Analysis

System analysis is the study of a problem domain and of the existing way of working, carried out to define *what* a new system must do before deciding *how* it will do it. For QRSathi the analysis was performed in two directions. First, the everyday workflow of the target users (Section 1.10) was examined to identify problems and requirements. Second, because the system already exists, the analysis was validated against the implementation: every requirement, role and business rule stated in this chapter corresponds to code that was located in the repository, and the source location is recorded in the traceability matrix (Section 3.16 and Appendix H).

## 2.2 Analysis of the Existing System

The "existing system" for a typical small shop or creator is not a single product but a set of manual steps and unrelated tools:

1. **QR codes** are made with a free web generator. The resulting image is downloaded and printed. The generator usually keeps no account history, so the same code is recreated when needed again.
2. **UPI payment QR codes** are obtained from a payment app or bank and printed. Creating a standee with a fixed amount or a merchant note requires another tool.
3. **Barcodes** are created on a separate website by typing a number. Whether the number is valid, unique, or allowed for internal use is left to the user.
4. **Labels** are designed in a word processor or image editor.
5. **Stock** is tracked in a spreadsheet or notebook; the quantity cell is overwritten when goods arrive or are sold.
6. **Scanning** uses the phone camera app, which opens links or payment apps without much warning.
7. **Changing a printed QR code** requires creating and reprinting a new one.

## 2.3 Problems and Limitations of the Existing Approach

Table 2.1: Problems of the existing approach

| # | Problem | Consequence |
|---|---|---|
| P1 | Data is spread across tools with no shared identity | Product, barcode and QR information is duplicated and diverges |
| P2 | Static QR codes cannot be edited | Reprinting cost; broken links in circulation |
| P3 | No validation of barcode numbers | Wrong check digits, duplicates, misuse of GS1 ranges |
| P4 | Stock overwritten without history | Discrepancies cannot be explained or audited |
| P5 | No scan statistics, or invasive tracking | Either no insight into campaigns, or privacy concerns |
| P6 | No access control on shared spreadsheets | Any person with the file can change everything |
| P7 | Scanning without safety warnings | Exposure to UPI "collect" scams and phishing links |
| P8 | Manual, one-at-a-time creation | Large catalogues are slow to label |

## 2.4 Proposed System

The proposed system, QRSathi, addresses these problems as follows:

Table 2.2: How the proposed system addresses each problem

| Problem | How QRSathi addresses it (verified in source) |
|---|---|
| P1 | One account owns QR codes, products, barcodes and stock records in a single relational database (`prisma/schema.prisma`). |
| P2 | Dynamic QR codes encode a short link (`/r/{code}`); the destination can be edited, paused or expired (`src/lib/qr-service.ts`, `src/app/r/[code]/route.ts`). |
| P3 | Each symbology validates length, character set and check digit; internal GTINs must use the 20–29 prefix; SKUs and barcodes are unique per user (`src/lib/barcodes.ts`, `src/lib/products.ts`). |
| P4 | Stock changes only through `in`, `out` and `adjust` movements, each recorded in `InventoryTransaction` with a signed quantity and resulting balance. |
| P5 | Scans record device type, browser, OS and country but never raw IP addresses; Do-Not-Track and Global Privacy Control reduce a scan to a count (`src/lib/scans.ts`). |
| P6 | Sessions, roles and ownership checks on every API route (`src/lib/session.ts`). |
| P7 | The scanner classifies content and runs heuristics for phishing URLs and UPI fraud (`src/lib/content-safety.ts`). |
| P8 | Bulk QR/barcode generation and CSV/XLSX product import (`src/app/(app)/bulk`, `src/app/api/products/import`). |

## 2.5 Feasibility Study

### 2.5.1 Technical Feasibility

The project uses mature, widely documented open-source technologies: Next.js 15.5 and React 19 for the web application, TypeScript 5.9 for static typing, Prisma 6.19 as the ORM, and SQLite/MySQL as databases. Specialised functions are provided by established libraries — `qrcode` for QR matrices, `bwip-js` for barcode encoding, and `zxing-wasm` for decoding. The technical feasibility is demonstrated by the fact that the application builds successfully (`next build` completed in 67 seconds during the audit) and passes its type checks and automated tests (Chapter 5). The only runtime requirement is Node.js 22.5 or later.

### 2.5.2 Economic Feasibility

All libraries in the dependency tree are open source; the licence report script (`npm run license:check`) ran successfully during the audit. Development requires only a personal computer. A small production deployment can run on a single virtual server with MySQL. Optional services have usage-based costs: Razorpay charges a fee per transaction, and an SMTP provider may charge for e-mail volume. No cost estimate for hosting was measured in this project; the statements above are qualitative.

### 2.5.3 Operational Feasibility

The user interface follows familiar patterns: a sidebar with grouped navigation (Workspace, Business, More tools, Account), a command palette, light/dark themes and responsive layouts that the browser test suite checks at 375, 768 and 1280 pixel widths. Administrators are created with a command-line tool (`npm run admin`), and operational documents for deployment, backup and recovery exist in `docs/`. No formal usability study with real users was conducted.

### 2.5.4 Schedule Feasibility

The Git history shows five commits, all dated 2026-10-25, followed by a large set of uncommitted changes. The repository history therefore does not provide a reliable project timeline, and no schedule data is reported. A recommended plan for completing outstanding work is given in Chapter 7.

### 2.5.5 Security and Maintenance Considerations

Security requirements are significant because the system stores personal data (e-mail addresses), payment records and administrator credentials. The implementation addresses them with server-side sessions, role checks, rate limits, CSRF origin checks, encrypted secrets and an audit log (Section 4.17). Maintainability is supported by TypeScript, a modular `src/lib` layer, ESLint, a CI workflow and Dependabot configuration (`.github/`). Maintenance risks include dependency vulnerabilities that are currently accepted with an expiry date (`security/audit-allowlist.json`), and the need to keep the SQLite and MySQL schemas synchronised — which is automated by `npm run db:mysql:schema -- --check`.

## 2.6 Stakeholder Analysis

Table 2.3: Stakeholder analysis

| Stakeholder | Interest | Influence | Key needs |
|---|---|---|---|
| Registered user (shop owner, creator) | High | Medium | Fast, valid codes; editable QR; simple stock tracking; data privacy |
| Visitor scanning a code | Medium | Low | Fast redirect; safe destination; no tracking without consent |
| Administrator | High | High | Moderation tools; visibility; protection against account takeover |
| Super administrator / owner | High | High | Control of roles, pricing, payments; audit trail |
| Payment provider (Razorpay) | Medium | Medium | Correct API use; webhook acknowledgement |
| Project guide / examiners | High | High | Correct, evidenced documentation; working demonstration |

## 2.7 Functional Requirements Overview

The functional requirements are grouped into modules. Detailed specifications with identifiers appear in Section 3.11.

Table 2.4: Functional requirements by module

| Module | Summary of functions |
|---|---|
| Accounts | Sign up, sign in (password, Google), sign out, forgot/reset password, profile and password change, sign out other devices, delete account |
| QR codes | Create static/dynamic/hosted QR codes for 27 types; design; export; save; list, search, favourite, edit, pause, duplicate, delete |
| Dynamic QR | Short-link redirect, hosted page, expiry, UTM, abuse reporting |
| Analytics | Scan counts by day, device, browser, OS, country; CSV export (plan-dependent) |
| Barcodes | Generate 23 symbologies; validate; labels; export |
| Scanner | Camera/image decoding; classification; safety notes; local history; product lookup |
| Products & inventory | Product CRUD with barcodes; archive/restore; stock in/out/adjust; low stock; history; import |
| Bulk | Batch QR and barcode generation from tables |
| Billing | View plans; subscribe; verify; cancel; payment history |
| Administration | Users, roles, suspension, sessions; QR moderation; abuse reports; analytics; audit and security events; settings, branding, appearance, e-mail, pricing, payment configuration; system status; MFA |

## 2.8 Non-Functional Requirements Overview

- **Security:** authenticated access to private data; role checks on administrative functions; protection against CSRF, XSS, brute force and session fixation; secrets never sent to the browser.
- **Privacy:** no raw IP storage in scan analytics or audit logs; honour Do-Not-Track/GPC.
- **Reliability:** atomic quota checks and stock movements; idempotent webhook processing; startup configuration validation that refuses unsafe production configurations.
- **Usability:** responsive layout without horizontal scrolling at common widths; accessible names for controls; light and dark themes.
- **Maintainability:** typed code, shared validation schemas, automated tests and CI.
- **Portability:** SQLite and MySQL from one schema; runs anywhere Node.js 22 runs.
- **Performance:** no measured targets exist in the repository; Section 3.12 lists proposed targets, explicitly marked as unmeasured.

## 2.9 User Roles and Permissions

The roles are defined in `src/lib/roles.ts` and enforced in `src/lib/session.ts`, `src/lib/guard.ts` and `src/lib/admin-users.ts`.

Table 2.5: User roles

| Role | How assigned | Permissions (summary) |
|---|---|---|
| Visitor (no account) | — | Open public pages, use the client-side generators and scanner, follow dynamic links, view hosted pages, submit abuse reports |
| `user` | Every sign-up (forced server-side) | Manage own QR codes, products, stock, uploads, analytics and subscription |
| `admin` | `npm run admin` CLI or a super administrator | Separate console sign-in; view statistics; suspend/reactivate users, revoke sessions, send reset links, change plans of ordinary users; moderate QR codes and reports; edit settings and branding |
| `super_admin` | CLI only (or promotion by another super admin) | Everything an admin can do, plus role changes, account deletion, pricing plans, payment credentials and subscription cancellation; must enable MFA before using the console |

A workspace session never grants administrative access, even for administrators: the console requires a separate sign-in that creates a distinct `qs_admin` session.

## 2.10 Use Cases and User Interactions

The principal use cases are shown in Figure 4.2 (Chapter 4). Their textual descriptions are:

Table 2.6: Use-case descriptions

| ID | Use case | Primary actor | Description |
|---|---|---|---|
| UC1 | Sign up / sign in | User | Create an account or authenticate with e-mail/password or Google |
| UC2 | Reset password | User | Request a one-hour, single-use reset link by e-mail |
| UC3 | Generate static QR | User / visitor | Choose a type, fill the form, style and export; signed-in users can save |
| UC4 | Create dynamic QR / hosted page | User | Create a QR whose destination can change; optionally a hosted landing page |
| UC5 | Generate barcodes and labels | User / visitor | Validate and render a barcode, lay out labels, export |
| UC6 | Scan a code | User / visitor | Decode from camera or image; see classification and warnings |
| UC7 | Manage products | User | Create/edit/archive/delete products with barcodes |
| UC8 | Record stock movement | User | Stock in, stock out or stock-take adjustment |
| UC9 | Bulk generate / import | User | Generate many codes or import products from CSV/XLSX |
| UC10 | View analytics | User | View scan statistics; export CSV where the plan allows |
| UC11 | Subscribe to a paid plan | User | Checkout through Razorpay; plan upgraded after verification |
| UC12 | Open dynamic QR / hosted page | Visitor | Be redirected or shown the hosted page; scan recorded |
| UC13 | Report abusive QR | Visitor | Report phishing, scams, malware etc. |
| UC14 | Moderate | Admin | Manage users, QR codes and abuse reports |
| UC15 | Configure site | Admin | Edit settings and branding |
| UC16 | Manage pricing | Super admin | Create, edit, publish, archive and reorder plans; sync provider plans |
| UC17 | Manage privileged settings | Super admin | Change roles, delete accounts, manage payment credentials |
| UC18 | Enrol MFA | Admin / super admin | Set up TOTP and recovery codes |
| UC19 | Deliver payment events | Razorpay | Send signed webhooks that update subscriptions and payments |

## 2.11 Business Rules

The following rules are enforced by the implementation:

- **BR1** Public sign-up always creates role `user`; any submitted `role` field is ignored (`src/app/api/auth/signup/route.ts`).
- **BR2** Passwords must have at least 8 characters including a letter and a digit; administrator passwords created by the CLI need at least 12 characters (`src/lib/auth-helpers.ts`, `scripts/admin.mts`).
- **BR3** A super administrator must enable MFA before using the console, cannot disable it, and the last super administrator cannot be demoted or deleted.
- **BR4** An SKU is unique per user; a barcode value is unique per user and format; equivalent GTIN forms (e.g. UPC-A and its EAN-13 form) are treated as duplicates through the `lookupKey`.
- **BR5** "Internal" EAN/UPC/ITF-14 numbers must use the restricted-circulation prefix 2 (20–29); numbers outside that range must be marked as GS1 "assigned".
- **BR6** Stock never becomes negative through a stock-out; scanning never changes stock; archived products cannot have stock changes and must be archived before permanent deletion.
- **BR7** Prices are stored as integers in minor units (paise); currencies are limited to INR, USD, EUR, GBP, AED and SGD.
- **BR8** Plan limits (saved QR codes, dynamic codes, hosted pages, products, barcodes, bulk rows, upload size, storage, analytics days and features) are checked on the server inside a transaction.
- **BR9** Dynamic QR codes require an http(s) destination; aliases are 3–40 characters and some words are reserved (`admin`, `api`, `login`, …).
- **BR10** A paid plan is granted only after server-side confirmation — a captured payment fetched from Razorpay or a signature-verified webhook — and duplicate webhook events have no effect.
- **BR11** Raw IP addresses are never stored; audit logs keep a salted hash of the IP and redact secrets.
- **BR12** A paid plan whose `planExpiresAt` has passed falls back to Free on the user's next authenticated request (`load()` in `src/lib/session.ts`).

## 2.12 Assumptions and Constraints

**Assumptions:** users access the system through a modern browser with JavaScript enabled; camera scanning requires a device camera and HTTPS (or localhost); production deployments set `NEXT_PUBLIC_APP_URL`, a strong `AUTH_SECRET` and HTTPS; an administrator installs and operates the server.

**Constraints:** Node.js 22.5 or later (declared in `package.json` `engines`); a single relational database; uploaded files on local disk (`UPLOAD_DIR`); Razorpay is the only payment provider implemented; Google is the only external identity provider; the in-memory rate limiter is per process unless `RATE_LIMIT_STORE=database`.

## 2.13 Risk Analysis

Table 2.7: Risk analysis

| Risk | Likelihood | Impact | Mitigation in the system / recommendation |
|---|---|---|---|
| Account takeover by password guessing | Medium | High | Per-IP, per-account and global rate limits; generic errors; bcrypt cost 12; MFA for administrators |
| Dynamic QR used for phishing | Medium | High | Abuse reports, admin moderation (pause/disable); recommendation: URL reputation checks |
| Personal data leaked from repository history | Present | High | Database backup exists in Git history (finding S-01); history rewrite and credential rotation recommended |
| Loss of uploaded files on server failure | Medium | Medium | Local-disk storage; backup procedure documented; recommendation: object storage |
| Payment state inconsistency | Low | High | Signature verification, API re-fetch, idempotent ledger |
| Rate limits ineffective across instances | Medium | Medium | `RATE_LIMIT_STORE=database` option |
| Dependency vulnerabilities | Medium | Medium | `npm run audit:check` with time-limited allowlist |
| Schema drift between SQLite and MySQL | Low | Medium | Generated MySQL schema with CI check |
| Concurrent edits to the codebase without commits | Present | Medium | Work was uncommitted during the audit; commit and tag a release before submission |

## 2.14 Comparative Analysis of Existing and Proposed Systems

The comparison below is between the *manual multi-tool approach* described in Section 2.2 and QRSathi as implemented. It is not a comparison with any specific commercial product, and no claim of superior performance is made because no benchmark was performed.

Table 2.8: Comparison of the existing approach and QRSathi

| Criterion | Existing approach | QRSathi (verified) |
|---|---|---|
| Integration of QR, barcode, scanning and stock | Separate tools | One application and database |
| Editable printed QR codes | Not possible with static codes | Dynamic short links with edit/pause/expiry |
| Barcode validation | Depends on tool; often none | Format rules, check digits, GS1 ranges, uniqueness |
| Stock history | Usually none | Append-only ledger with balances |
| Access control | File sharing | Accounts, roles, admin console with MFA |
| Scan analytics | None, or third-party tracking | Built-in, privacy-preserving |
| Scam warnings while scanning | Rarely | Heuristic warnings for URLs and UPI |
| Bulk operations | Manual | Batch generation and import |
| Cost | Free tools; time-consuming | Open-source stack; hosting and payment fees apply |
| Offline use | Spreadsheets work offline | Requires network for the server; generation and scanning run client-side once loaded |
