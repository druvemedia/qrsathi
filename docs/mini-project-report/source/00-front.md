# Certificate

This is to certify that the mini project report entitled **"QRSathi — QR Code, Barcode and Inventory Management System"** is a bonafide record of the work carried out by **[Student Name]** (Roll No. **[Roll Number]**) in partial fulfilment of the requirements for the award of the degree of **[Degree and Branch]** of **[University Name]**, during the academic year **[Academic Year]**, under my supervision and guidance.

The work embodied in this report has not been submitted, in part or in full, to any other university or institution for the award of any degree or diploma.

[[SIGNATURES:Project Guide|[Guide Name], [Designation]|Head of the Department|[HoD Name], [Department]]]

[[SIGNATURES:Internal Examiner|Name and signature|External Examiner|Name and signature]]

Date: [Date of submission]     Place: [Place]

# Declaration

I, **[Student Name]**, Roll No. **[Roll Number]**, hereby declare that the mini project report entitled **"QRSathi — QR Code, Barcode and Inventory Management System"**, submitted to **[Department Name], [Institution Name]**, affiliated to **[University Name]**, is a record of original work carried out by me under the guidance of **[Guide Name]**.

I further declare that the source code, measurements and test results reported in this document were obtained from the project repository and test runs described in Chapter 5, that results which could not be verified are explicitly marked as such, and that this report has not been submitted elsewhere for the award of any degree or diploma.

[[SIGNATURES:Signature of the student|[Student Name]|Date|[Date]]]

# Acknowledgement

I express my sincere gratitude to **[Guide Name]**, **[Designation]**, **[Department Name]**, for guidance, encouragement and constructive feedback throughout the development of this project.

I am thankful to **[HoD Name]**, Head of the **[Department Name]**, and to **[Principal / Director Name]**, **[Institution Name]**, for providing the facilities and environment required to complete this work.

I also thank the faculty and laboratory staff of the department, and my family and friends, for their support. Finally, I acknowledge the maintainers of the open-source projects on which QRSathi is built — Next.js, React, Prisma, TypeScript, Tailwind CSS, bwip-js, zxing-wasm and the other libraries listed in Chapter 3 — whose documentation and software made this project possible.

**[Student Name]**

# Abstract

Quick Response (QR) codes and one-dimensional barcodes are now the everyday interface between printed material and digital systems: shops display UPI payment QR codes, products carry EAN-13 barcodes, and marketing material links to websites through QR codes. Small businesses in India, however, typically depend on several unrelated tools for these tasks — a free QR generator, a separate barcode label tool, a spreadsheet for stock, and no means of changing a printed QR code's destination after it has been distributed. This fragmentation leads to duplicated data, invalid barcodes, untraceable stock movements and printed codes that cannot be corrected.

**QRSathi** is a web application that integrates these functions in one system. Its objectives are to generate standards-compliant QR codes and barcodes, to support editable ("dynamic") QR codes with privacy-respecting scan analytics, to manage products, barcodes and stock as an auditable inventory ledger, and to provide a secure administration console with role-based access control and an optional subscription billing module.

The system is implemented as a full-stack **Next.js 15** application written in **TypeScript 5.9**, using **React 19** for the user interface, **Tailwind CSS 3.4** for styling and **Prisma ORM 6.19** for data access. SQLite is used for development and a generated MySQL schema with versioned migrations is provided for production. The architecture is a layered monolith: App Router pages and 64 API route modules (89 HTTP method handlers) delegate to server-side domain modules (QR service, products, billing, entitlements), which access a relational schema of 22 models through Prisma. QR images are rendered as SVG in the browser; barcodes are rendered with bwip-js; scanning runs entirely in the browser using the zxing-wasm decoder.

The audit carried out for this report verified the following principal modules in source code and automated tests: a QR generator supporting 27 content types (URL, Wi-Fi, vCard, UPI payment, WhatsApp and others) with design customisation and export to PNG, JPG, SVG, PDF and ZIP; dynamic QR codes with short links, expiry, pause, UTM parameters and scan analytics; a barcode generator for 23 symbologies with check-digit validation and printable labels; a camera and image scanner with phishing and UPI-fraud heuristics; product and inventory management with per-user SKU and barcode uniqueness and an append-only stock ledger; bulk generation and spreadsheet import; an administration console with three roles (user, admin, super administrator), TOTP multi-factor authentication, audit logging and branding/pricing configuration; and Razorpay subscription billing with signature verification and idempotent webhooks.

Testing was performed by executing the project's own test suites against an isolated production build and a throw-away database: TypeScript type checking and linting completed without errors; the unit suites passed (134 security assertions, the QR rendering/decoding suite and 166 barcode assertions); and the API (73), administration/security (99), billing and browser suites were executed with the results reported in Chapter 5. The audit also identified defects and risks, the most significant being that uploads larger than 10 MB fail for paid plans that advertise 25–50 MB limits, and that a development database containing password hashes remains in the Git history.

QRSathi demonstrates that a single, well-structured web application can replace several disconnected tools while applying sound security engineering — server-side sessions, CSRF origin checks, rate limiting, encrypted secrets and audit trails. Its limitations, such as local-disk file storage, the absence of e-mail verification and the lack of a measured performance baseline, are documented together with future enhancements.

**Keywords:** QR code, barcode, GS1, inventory management, Next.js, TypeScript, Prisma, role-based access control, multi-factor authentication, Razorpay.

# List of Abbreviations

| Abbreviation | Expansion |
|---|---|
| 2FA / MFA | Two-factor / Multi-factor authentication |
| AES-GCM | Advanced Encryption Standard in Galois/Counter Mode |
| API | Application Programming Interface |
| CI | Continuous Integration |
| CRUD | Create, Read, Update, Delete |
| CSP | Content Security Policy |
| CSRF | Cross-Site Request Forgery |
| CSV | Comma-Separated Values |
| DFD | Data-Flow Diagram |
| DNT / GPC | Do Not Track / Global Privacy Control |
| DPDP | Digital Personal Data Protection (Act, 2023, India) |
| ECC | Error-Correction Capacity (QR code) |
| EAN | European Article Number (International Article Number) |
| ERD | Entity-Relationship Diagram |
| GS1 | Global standards organisation for supply-chain identification |
| GTIN | Global Trade Item Number |
| HMAC | Hash-based Message Authentication Code |
| HSTS | HTTP Strict Transport Security |
| HTTP(S) | Hypertext Transfer Protocol (Secure) |
| IDOR | Insecure Direct Object Reference |
| IFSC | Indian Financial System Code |
| ISBN / ISSN | International Standard Book / Serial Number |
| JSON | JavaScript Object Notation |
| JWT | JSON Web Token |
| MIME | Multipurpose Internet Mail Extensions |
| OIDC | OpenID Connect |
| ORM | Object-Relational Mapping |
| PDF | Portable Document Format |
| QR | Quick Response (code) |
| RBAC | Role-Based Access Control |
| RFC | Request for Comments (IETF standard) |
| RSC | React Server Components |
| RTM | Requirement Traceability Matrix |
| SKU | Stock-Keeping Unit |
| SMTP | Simple Mail Transfer Protocol |
| SQL | Structured Query Language |
| SVG | Scalable Vector Graphics |
| TLS | Transport Layer Security |
| TOTP | Time-based One-Time Password |
| UI / UX | User Interface / User Experience |
| UPC | Universal Product Code |
| UPI | Unified Payments Interface |
| URL | Uniform Resource Locator |
| UTM | Urchin Tracking Module (campaign parameters) |
| VPA | Virtual Payment Address (UPI ID) |
| WASM | WebAssembly |
| XSS | Cross-Site Scripting |
