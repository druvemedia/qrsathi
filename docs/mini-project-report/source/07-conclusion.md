# Chapter 7: Conclusion and Future Enhancements

## 7.1 Conclusion

QRSathi set out to replace a fragmented set of tools — QR generators, barcode websites, phone scanners and stock spreadsheets — with one secure web application for small businesses. The audit carried out for this report confirms that the project achieves this aim to a substantial degree. The application integrates QR generation for 27 content types, dynamic QR codes with privacy-respecting analytics, barcode generation for 23 symbologies with standards-based validation, in-browser scanning with fraud warnings, a product catalogue with an append-only inventory ledger, bulk tools, a separate MFA-protected administration console, and plan-based billing through Razorpay.

The verified technical contribution lies less in any single feature than in the way the features are engineered: validation schemas shared by browser and server; server-side sessions that can be revoked instantly; deny-by-default authorization; transactions that keep quotas and stock consistent under concurrency; idempotent payment processing; encrypted storage of secrets; and a schema that runs on both SQLite and MySQL. These properties are not just claimed — 745 integration and end-to-end assertions, 300 unit assertions and 32 MySQL assertions passed in the final audit run.

The audit also found problems that must be addressed before production use: uploads above 10 MB fail on paid plans (D-01), a minor admin layout overflow and stale browser-test expectations (D-03, D-04), a hard-coded plan list in one admin endpoint (D-05), and — most importantly for publication — a development database with password hashes in the Git history (D-07). A large part of the latest work was also uncommitted at the time of the audit.

## 7.2 Achievement of Objectives

Table 7.1: Objectives versus results

| Objective | Result | Evidence | Assessment |
|---|---|---|---|
| O1 QR generation with validation and scannable designs | 27 types; zod validation; design warnings; post-export scan test | test:qr; TC-QR-01..08 | Achieved |
| O2 Dynamic QR with privacy-preserving analytics | Short links with edit/pause/expiry/UTM; scan cap; no raw IPs; DNT/GPC | test:api, test:admin, probes | Achieved |
| O3 Standard barcodes with check digits and labels | 23 formats; GS1 check digits; labels in 6 sizes | test:barcodes (166) | Achieved |
| O4 Browser scanning with risk warnings | Camera and multi-code image decoding; URL/UPI heuristics | test:browser | Achieved (Chromium) |
| O5 Products and auditable inventory | Per-user uniqueness; ledger with balances; non-negative stock | test:api | Achieved |
| O6 Bulk generation and import | Import verified; bulk generation UI present | test:api; source review | Largely achieved |
| O7 Secure authentication, RBAC, MFA console | Separate admin sessions, TOTP, recovery codes, audit | test:admin (99) | Achieved |
| O8 Plans with server-enforced limits and payments | Entitlements and Razorpay lifecycle verified with mock provider | test:billing (128) | Partially achieved: live payments not verified; D-01 affects upload limits |
| O9 SQLite and MySQL from one schema | Generated schema, migrations, data migration | test:mysql (32) | Achieved |
| O10 Automated verification | Unit, API, admin, billing, browser and MySQL suites; CI workflow | Chapter 5 | Achieved (coverage percentage unknown) |

## 7.3 Major Contributions

1. An integrated, open-source-ready platform combining QR codes, barcodes, scanning and inventory for Indian small businesses.
2. A type-registry design in which each QR type declares its own fields, validation and payload builder, shared by client and server.
3. GTIN normalisation (lookup keys) so that equivalent barcode forms match the same product, and enforcement of GS1 restricted-circulation ranges for internal numbers.
4. A privacy-preserving approach to scan analytics.
5. A security architecture suitable as a teaching example: revocable sessions, separate admin console, TOTP with replay protection, CSRF origin checks, sealed secrets and audit logging.
6. A comprehensive automated test set, including real-browser camera tests and real-MySQL migration tests.

## 7.4 Current Limitations

- File uploads above 10 MB fail (D-01); files are stored on local disk.
- No e-mail verification; resets require SMTP.
- External integrations (Google, SMTP, live Razorpay) unverified.
- No performance or load testing; no code-coverage measurement.
- Automated browser testing on Chromium only.
- Scan history not synchronised across devices.
- Personal data in Git history; much work uncommitted at the time of the audit.

## 7.5 Future Enhancements

The following are proposals; none of them is implemented unless stated.

Table 7.2: Proposed future enhancements

| Area | Enhancement | Note |
|---|---|---|
| Correctness | Fix D-01 (exclude `/api/uploads` from the middleware matcher or raise the middleware body limit) and add a regression test | Highest priority |
| Analytics and reporting | Scheduled reports; campaign comparison; inventory valuation and movement reports | Scan analytics and CSV export already exist |
| Bulk processing | Background jobs for very large batches; progress tracking | Client-side bulk generation exists |
| Export formats | EPS/vector PDF labels for print shops; Excel export of inventory | PNG/JPG/SVG/PDF/ZIP exist |
| Inventory alerts | E-mail/WhatsApp low-stock and expiry alerts; multi-location stock | Low-stock flag exists in UI |
| Audit logs | Export and retention policies; tamper-evident hashing | Audit log exists |
| Permissions | Team workspaces with per-member roles (owner, editor, viewer) | Currently one owner per account |
| Authentication | E-mail verification; passkeys (WebAuthn); MFA for all users; breached-password checks | TOTP exists for admins |
| Accessibility | Manual WCAG 2.2 AA audit; screen-reader testing | Automated name checks exist |
| Performance | Load testing; caching of hosted pages; database indexes reviewed with real data | — |
| Backups and recovery | Automated scheduled backups and restore drills | Procedure documented only |
| Monitoring | Metrics and tracing (e.g. OpenTelemetry); alerting on health and errors | Health endpoint and logs exist |
| Payments | Additional providers; invoices with GST details; coupons | Razorpay subscriptions exist |
| Internationalisation | Hindi and regional-language UI; locale formatting | UI is English |
| API and integrations | Public REST API with API keys; OpenAPI documentation; webhooks for scans | Internal API only |
| Testing | Coverage reporting; Firefox/Safari/mobile device tests; contract tests against Razorpay test mode | Large suite exists |
| Storage | Object storage (S3-compatible) for uploads | `storage.ts` designed to be replaceable |
| Security | URL reputation checks for dynamic destinations; CSP nonces; Git history clean-up | See Table 4.12 |

## 7.6 Long-Term Scope

In the long term QRSathi could evolve into a small-business identification platform: a native or progressive-web mobile app for offline scanning and stock-taking, point-of-sale integration, GS1 Digital Link support (QR codes that carry GTINs and resolve to product information), supplier and purchase-order management, and analytics that connect scans to sales. Because the core is a typed, layered code base with a portable schema and automated tests, these extensions can be added incrementally.

## 7.7 Final Conclusion

QRSathi is a working, well-engineered mini project that meets most of its objectives with evidence. It demonstrates practical skills in full-stack web development, database design, security engineering and automated testing. With the documented defects fixed, the work committed and the repository history cleaned, it would be a sound foundation for a production service.
