# References

References follow the IEEE style. All web sources were accessed on 25 October 2026. URLs marked † returned HTTP 403 to the automated link check (bot protection on the publisher's site) and should be confirmed manually in a browser before submission; all other URLs returned HTTP 200.

[1] Vercel, "Next.js Documentation." [Online]. Available: https://nextjs.org/docs

[2] Vercel, "Next.js API Reference: middleware." [Online]. Available: https://nextjs.org/docs/app/api-reference/file-conventions/middleware

[3] Meta Open Source, "React Reference." [Online]. Available: https://react.dev/reference/react

[4] Microsoft, "TypeScript Documentation." [Online]. Available: https://www.typescriptlang.org/docs/

[5] Prisma Data, Inc., "Prisma ORM Documentation." [Online]. Available: https://www.prisma.io/docs

[6] Tailwind Labs, "Tailwind CSS v3 Documentation." [Online]. Available: https://v3.tailwindcss.com/docs

[7] Oracle Corporation, "MySQL 8.4 Reference Manual." [Online]. Available: https://dev.mysql.com/doc/refman/8.4/en/ †

[8] International Organization for Standardization, *ISO/IEC 18004:2015 Information technology — Automatic identification and data capture techniques — QR Code bar code symbology specification*. Geneva, Switzerland: ISO, 2015. [Online]. Available: https://www.iso.org/standard/62021.html †

[9] GS1, "GS1 General Specifications." [Online]. Available: https://www.gs1.org/standards/barcodes-epcrfid-id-keys/gs1-general-specifications †

[10] GS1, "Check Digit Calculator." [Online]. Available: https://www.gs1.org/services/check-digit-calculator †

[11] DENSO WAVE Inc., "History of QR Code." [Online]. Available: https://www.qrcode.com/en/history/

[12] D. M'Raihi, S. Machani, M. Pei and J. Rydell, "TOTP: Time-Based One-Time Password Algorithm," RFC 6238, IETF, May 2011. [Online]. Available: https://www.rfc-editor.org/rfc/rfc6238

[13] D. M'Raihi, M. Bellare, F. Hoornaert, D. Naccache and O. Ranen, "HOTP: An HMAC-Based One-Time Password Algorithm," RFC 4226, IETF, Dec. 2005. [Online]. Available: https://www.rfc-editor.org/rfc/rfc4226

[14] H. Krawczyk, M. Bellare and R. Canetti, "HMAC: Keyed-Hashing for Message Authentication," RFC 2104, IETF, Feb. 1997. [Online]. Available: https://www.rfc-editor.org/rfc/rfc2104

[15] M. Jones, J. Bradley and N. Sakimura, "JSON Web Token (JWT)," RFC 7519, IETF, May 2015. [Online]. Available: https://www.rfc-editor.org/rfc/rfc7519

[16] OWASP Foundation, "OWASP Cheat Sheet Series" (Authentication, Session Management, Cross-Site Request Forgery Prevention, Password Storage). [Online]. Available: https://cheatsheetseries.owasp.org/

[17] OWASP Foundation, "OWASP Top 10:2021." [Online]. Available: https://owasp.org/Top10/

[18] P. A. Grassi *et al.*, "Digital Identity Guidelines: Authentication and Lifecycle Management," NIST SP 800-63B. [Online]. Available: https://pages.nist.gov/800-63-3/sp800-63b.html

[19] Mozilla, "Content-Security-Policy," MDN Web Docs. [Online]. Available: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy

[20] W3C, "Web Content Accessibility Guidelines (WCAG) 2.2," W3C Recommendation. [Online]. Available: https://www.w3.org/TR/WCAG22/

[21] Razorpay, "Subscriptions." [Online]. Available: https://razorpay.com/docs/payments/subscriptions/

[22] Razorpay, "Validate and Test Webhooks." [Online]. Available: https://razorpay.com/docs/webhooks/validate-test/

[23] National Payments Corporation of India, "Unified Payments Interface (UPI): Product Overview." [Online]. Available: https://www.npci.org.in/what-we-do/upi/product-overview †

[24] C. McDonnell, "Zod Documentation." [Online]. Available: https://zod.dev

[25] metafloor, "bwip-js: Barcode Writer in Pure JavaScript," GitHub repository. [Online]. Available: https://github.com/metafloor/bwip-js

[26] Sec-ant, "zxing-wasm: ZXing-C++ WebAssembly build," GitHub repository. [Online]. Available: https://github.com/Sec-ant/zxing-wasm

[27] soldair, "node-qrcode: QR code generator," GitHub repository. [Online]. Available: https://github.com/soldair/node-qrcode

[28] SQLite Consortium, "SQLite Documentation." [Online]. Available: https://www.sqlite.org/docs.html

[29] Mermaid contributors, "Mermaid: Diagramming and charting tool." [Online]. Available: https://mermaid.js.org

[30] QRSathi project repository, source code and documentation (`README.md`, `docs/*.md`), branch `main`, commit `9b5dae7` plus working-tree changes as of 25 Oct. 2026. Remote: https://github.com/druvemedia/qrsathi (not accessed during the audit; the local copy was used).

# Appendix A: Project Directory Structure

The tree below lists source, configuration and documentation files. Dependencies (`node_modules`), build outputs (`.next*`), uploaded files, databases and backups, and secret files (`.env`) are excluded.

[[DIRTREE]]

# Appendix B: API Endpoint Inventory

Methods and guards were extracted automatically from each `route.ts` file at build time; purposes were written by the auditor after reading each handler. "Guard" lists the authentication/authorization and rate-limit calls found in the file. All `/api` POST/PUT/PATCH/DELETE requests (except the webhook) must come from the application's own origin.

[[API_INVENTORY]]

# Appendix C: Database Data Dictionary

Generated from `prisma/schema.prisma`; the MySQL column type is taken from the generated `prisma/mysql/schema.prisma` (Prisma's default mapping `VARCHAR(191)` applies where no explicit type is given). No data from any database was read for this dictionary.

[[DATA_DICTIONARY]]

# Appendix D: Detailed Test Cases

Status values: **Pass** — executed and met the expected result; **Fail** — executed and did not; **Not executed** — documented procedure, not run (reason given). Evidence quotes the assertion text printed by the suite in the final run, or names the audit probe.

[[TESTCASES_FULL]]

# Appendix E: Installation and Execution Guide

**Prerequisites.** Node.js ≥ 22.5 and npm ≥ 10; Git; a Chromium-based browser for the browser tests; optionally MySQL 8 (or Docker) and SMTP, Google and Razorpay accounts.

**Development set-up.**

```bash
git clone https://github.com/druvemedia/qrsathi.git
cd qrsathi
npm install                       # also generates Prisma client and copies the scanner WASM
cp .env.example .env              # then edit: DATABASE_URL, AUTH_SECRET (32+ random chars), NEXT_PUBLIC_APP_URL
npm run db:push                   # create the SQLite database
npm run admin -- create --email you@example.com --super   # password via stdin
npm run dev                       # http://localhost:3000
```

**Quality checks.**

```bash
npm run typecheck && npm run lint && npm test
```

**Integration tests (isolated, as performed in this audit).**

```bash
# build into a separate folder and use a throw-away database
export NEXT_DIST_DIR=.next-test DATABASE_URL="file:/absolute/path/test.db" \
       NEXT_PUBLIC_APP_URL=http://localhost:3100 AUTH_SECRET=<random 32+ chars>
npx prisma db push --skip-generate
npx next build
NODE_ENV=production npx next start -p 3100 &
BASE_URL=http://localhost:3100 npm run test:api
BASE_URL=http://localhost:3100 npm run test:admin
BASE_URL=http://localhost:3100 npm run test:browser
# billing: restart the server with RAZORPAY_API_BASE=http://127.0.0.1:3999 and SETTINGS_ENCRYPTION_KEY set,
# without RAZORPAY_* keys, then: BASE_URL=http://localhost:3100 npm run test:billing
MYSQL_TEST_URL="mysql://root:<pw>@127.0.0.1:3306/" npm run test:mysql
```

Never point the integration tests at a real database: they create and delete accounts.

**Production (summary).** `npm ci` → set production variables → `npm run db:mysql:deploy` → `npm run build` → `npm start` behind an HTTPS reverse proxy → create the super administrator and enrol MFA. See Section 6.20 and `docs/DEPLOYMENT.md`.

# Appendix F: Configuration Reference

The complete list of environment variables with purposes is Table 3.6. Additional configuration lives in:

Table F.1: Configuration files

| File | Purpose |
|---|---|
| `next.config.mjs` | Security headers (CSP etc.), separate build directory, server-external packages, admin no-store/noindex headers, sandbox CSP for `/f` and `/brand` |
| `src/middleware.ts` | CSRF origin rule; matcher `/api/:path*`, `/admin`, `/admin/:path*` |
| `src/lib/env-check.ts` | Start-up validation rules |
| `prisma/schema.prisma` | Canonical database schema (SQLite) |
| `prisma/mysql/schema.prisma` | Generated MySQL schema (do not edit by hand) |
| `src/lib/plans.ts` | Default plan catalogue (seeded only into an empty table) and limit schema |
| `tailwind.config.ts`, `postcss.config.mjs` | Styling |
| `tsconfig.json`, `eslint.config.mjs` | TypeScript and lint rules |
| `.github/workflows/ci.yml` | CI pipeline (quality job and MySQL job) |
| `.github/dependabot.yml` | Dependency update automation |
| `security/audit-allowlist.json` | Accepted dependency advisories with expiry |
| Admin console → Settings | Runtime settings stored in the `Setting` table (announcement, sign-ups, branding, sealed payment credentials) |

# Appendix G: Screenshot Index

All screenshots were captured by `scripts/test-browser.mts` (with `SHOT_DIR`) from the production build during the final audit run (2026-10-25, 18:41–18:47 IST) using throw-away test accounts. They are stored unmodified in `screenshots/desktop-1280/` and `screenshots/mobile-375/`. Screenshots of 768 px widths were captured but not included.

[[SCREENSHOT_INDEX]]

# Appendix H: Requirement Traceability Matrix

[[RTM_FULL]]

# Appendix I: Glossary

Table I.1: Glossary of terms

| Term | Meaning |
|---|---|
| Alias | A user-chosen short code for a dynamic QR (paid plans) |
| App Router | The Next.js routing system based on the `src/app` directory |
| Check digit | A digit computed from the others to detect misreads (GS1 modulo-10) |
| Dynamic QR | A QR code that encodes a short link whose destination can be changed |
| Entitlement | A plan limit or feature checked by the server |
| GTIN | Global Trade Item Number (8, 12, 13 or 14 digits) |
| Hosted page | A mobile landing page served by QRSathi at `/p/{code}` |
| Idempotent | Producing the same result when repeated (e.g. a webhook delivered twice) |
| Ledger | Append-only list of stock movements with resulting balances |
| Lookup key | Normalised form of a barcode used to match scans to products |
| Middleware | Code that runs before route handlers for matching paths |
| Prisma | Type-safe ORM used for database access and migrations |
| Quiet zone | Blank margin around a code needed by scanners |
| Restricted circulation | GS1 prefix range 20–29 reserved for internal numbering |
| Route handler | A Next.js server function handling an HTTP method for a path |
| Sealed secret | A credential encrypted with AES-256-GCM using a key held only in the environment |
| Session version | Counter on the user that invalidates all tokens when incremented |
| Short code | The random identifier in a dynamic link `/r/{code}` |
| Snapshot | A copy of data (e.g. plan price) stored with a record so history does not change |
| Super administrator | Highest role; manages roles, pricing and payment credentials |
| TOTP | Six-digit code that changes every 30 seconds (RFC 6238) |
| UPI | India's real-time payment system; QR codes use `upi://pay` links |
| UTM parameters | Campaign tags appended to destination URLs |
| Webhook | An HTTP callback from a provider (Razorpay) to the application |
| zod | Schema library used to validate input on client and server |
