# Chapter 1: Introduction

## 1.1 Introduction to the Project

QRSathi ("Sathi" means "companion" in Hindi) is a web-based platform for creating QR codes and barcodes and for managing the products and stock those codes identify. It combines, in one authenticated workspace, a QR code generator, a dynamic (editable) QR service with scan analytics, a barcode and label generator, a browser-based scanner, a product catalogue with an inventory ledger, bulk generation tools, an administration console and an optional subscription billing module.

The project is implemented as a single Next.js application written in TypeScript. The browser renders QR codes and barcodes as SVG images and decodes codes from the camera using WebAssembly, while the server stores accounts, codes, products and stock movements in a relational database through the Prisma ORM. The application is designed for Indian small businesses — for example, it generates UPI payment QR codes, stores prices in paise and formats numbers in the Indian locale — but nothing in its architecture is specific to one country.

This report documents the project as it exists in the repository at the time of the audit (branch `main`, latest commit `9b5dae7`, plus uncommitted working-tree changes — see Section 1.14) [30]. Every functional claim in this report was checked against the source code, and wherever possible against automated tests that were executed for this report (Chapter 5). The report distinguishes clearly between general background (Sections 1.2–1.4) and what QRSathi actually implements (Sections 1.12 onward).

## 1.2 Background of QR Code Technology

*This section describes QR codes in general; it does not describe QRSathi specifically.*

A QR (Quick Response) code is a two-dimensional matrix symbology invented in 1994 by Denso Wave, a Toyota group company, to track automotive parts. It was later standardised internationally as ISO/IEC 18004 [8], [11]. A QR symbol consists of dark and light square modules arranged in a grid; three large *finder patterns* in the corners allow a reader to locate the symbol and determine its orientation from any angle, and *timing* and *alignment* patterns help correct for distortion.

Key properties of QR codes relevant to this project are:

- **Versions.** Symbols range from version 1 (21 × 21 modules) to version 40 (177 × 177 modules). Larger versions hold more data.
- **Error correction.** Reed–Solomon error correction allows a symbol to be decoded even when part of it is damaged or covered. Four levels are defined — L, M, Q and H — recovering roughly 7%, 15%, 25% and 30% of the codewords respectively. Higher levels make it possible to place a logo in the centre of a QR code, at the cost of a denser symbol.
- **Encoding modes.** Numeric, alphanumeric, byte and Kanji modes allow efficient encoding of different kinds of content.
- **Content conventions.** A QR code only stores text. Phones interpret that text according to informal conventions: `https://…` opens a browser, `WIFI:T:WPA;S:…;P:…;;` joins a Wi-Fi network, `BEGIN:VCARD…` adds a contact, and `upi://pay?pa=…` opens a UPI payment app [23].

A distinction that is central to QRSathi is between **static** and **dynamic** QR codes. A static QR code encodes its final content directly; once printed it can never change. A *dynamic* QR code encodes a short URL controlled by a service; the service redirects the visitor to a destination that can be edited, paused or expired later, and can count scans. Dynamic codes are a service convention rather than a different symbology — the printed symbol is an ordinary QR code containing a URL.

## 1.3 Background of Barcode Technology

*This section describes barcodes in general.*

Linear (one-dimensional) barcodes encode data in the widths of parallel bars and spaces. The Universal Product Code (UPC) was adopted by the US grocery industry in 1973 and first scanned at a retail checkout in 1974; the European Article Number (EAN, now "International Article Number") followed in 1977. Today the GS1 organisation administers the global numbering system on which retail barcodes depend [9], [10].

Barcode *symbologies* differ in the characters they can encode and their intended use:

- **EAN-13, EAN-8, UPC-A and UPC-E** encode Global Trade Item Numbers (GTINs) for retail products. They are numeric-only and end with a *check digit* calculated with the GS1 modulo-10 algorithm, which lets a scanner reject most misreads.
- **ITF-14** encodes GTINs for cartons and shipping units.
- **GS1-128** encodes GS1 *Application Identifiers* such as (01) GTIN, (10) batch/lot and (17) expiry date.
- **Code 128, Code 39, Code 93 and Codabar** are general-purpose symbologies commonly used for internal labels, asset tags and libraries.
- **Two-dimensional symbologies** such as Data Matrix, PDF417 and Aztec store much more data in a small area and tolerate damage.

An important business rule is that GTINs used on goods sold through retail channels must be allocated by GS1 to the brand owner. Numbers beginning with the prefix 20–29 are reserved for *restricted circulation* (internal use within a company), which makes them safe for a business's own labels.

## 1.4 Introduction to Inventory and Product Identification Systems

An inventory system records which items an organisation holds and how many units of each are available. Its core concepts are:

- a **product master** (catalogue) describing each stock-keeping unit (SKU): name, code, category, price, supplier and attributes;
- **identifiers** linking a physical item to its record — SKUs, barcodes, QR codes or RFID tags;
- **stock movements** (receipts, issues and adjustments) that change the quantity on hand; and
- **controls** such as re-order (low-stock) levels, batch and expiry tracking, and an audit trail of who changed what and when.

Barcode scanning reduces manual data entry and transcription errors: scanning an item retrieves its record directly, after which a movement can be recorded. A well-designed system treats the stock quantity as the result of recorded movements rather than as a free-form number, so that every change can be explained.

## 1.5 Problem Statement

Small retailers, shops, creators and organisations increasingly need QR codes (for payments, menus, links and contact details) and barcodes (for products and labels), but commonly face the following problems:

1. **Fragmented tools.** QR generation, barcode/label printing, scanning and stock tracking are performed in separate applications or spreadsheets with no shared data.
2. **Unchangeable printed codes.** A static QR code printed on posters or packaging cannot be corrected when a URL changes; reprinting is costly.
3. **Invalid identifiers.** Barcode numbers created by hand often have wrong check digits, duplicate other products, or use GTIN ranges that should be reserved for GS1-allocated numbers.
4. **Untraceable stock.** Stock quantities kept in spreadsheets are overwritten without a history, so discrepancies cannot be explained.
5. **Scanning risks.** QR-code fraud — fake payment QR codes, phishing links and malicious app downloads — is common, and generic scanner apps rarely warn the user.
6. **Security and privacy.** Many free online tools require no account, offer no access control, and track scanners extensively.

The problem addressed by this project is therefore: *to design and implement a secure, integrated web application through which a small business can generate valid QR codes and barcodes, keep printed QR codes editable, scan codes safely, and manage products and stock with a complete audit trail.*

## 1.6 Motivation for Developing QRSathi

The motivation came from observing everyday use of codes in Indian retail: UPI QR standees at counters, hand-written price labels next to barcoded goods, and QR codes on menus and posters that lead to outdated pages. Building a single product that handles all of these use cases also provided an opportunity to study, in a realistic codebase, topics central to a computer-science curriculum: relational database design, web application architecture, authentication and authorization, input validation, secure handling of payments and secrets, automated testing and deployment.

## 1.7 Project Objectives

The objectives of QRSathi, as reflected in its implementation, are:

- **O1.** Generate QR codes for common content types with validation of the content and customisable, scannable designs.
- **O2.** Provide dynamic QR codes whose destination can be edited, paused or expired after printing, with privacy-preserving scan analytics.
- **O3.** Generate barcodes in standard symbologies with correct check digits and printable labels.
- **O4.** Scan QR codes and barcodes from a camera or image in the browser, and warn users about risky content.
- **O5.** Manage products, their barcodes and stock through an auditable inventory ledger with low-stock indication.
- **O6.** Support bulk generation and spreadsheet import for larger catalogues.
- **O7.** Protect accounts and data with secure authentication, role-based access control and a separate, MFA-protected administration console.
- **O8.** Offer configurable plans with server-enforced limits and optional online subscription payments.
- **O9.** Support SQLite for development and MySQL for production from one schema.
- **O10.** Verify behaviour through automated tests.

Section 7.2 evaluates each objective against the audit evidence.

## 1.8 Project Scope

**In scope (implemented):** web user interface for desktop and mobile browsers; account registration and sign-in (password and optional Google sign-in); QR generation, saving, editing and export; dynamic QR codes and hosted landing pages; scan analytics; barcode and label generation; in-browser scanning; products, barcodes and stock movements; bulk QR/barcode generation and product import; plan entitlements; administration console; Razorpay subscriptions; SQLite and MySQL database support; automated tests and a CI workflow.

**Out of scope:** native mobile applications; point-of-sale billing (sales invoices, GST); multi-warehouse inventory; purchase orders and suppliers; hardware integration with dedicated barcode printers or scanners beyond what the browser supports; and GS1 number allocation itself (QRSathi validates GS1 numbers but cannot issue official ones).

## 1.9 Significance of the Project

The project is significant in three ways. *Practically*, it gives small businesses one tool for tasks that otherwise require several, and it enforces correctness (check digits, unique SKUs, non-negative stock) that ad-hoc tools do not. *Socially*, its scanner warns about common QR-code frauds such as "scan to receive money" UPI scams. *Academically*, it is a complete, tested example of a modern full-stack application that applies security practices — server-side sessions, CSRF defence, rate limiting, encrypted secrets, MFA and audit logging — which are often omitted from student projects.

## 1.10 Intended Users and Stakeholders

- **Registered users** — shop owners, small businesses, creators and organisations who create codes and manage products.
- **Visitors** — members of the public who scan a QR code produced with QRSathi and are redirected or shown a hosted page; they need no account.
- **Administrators** — platform staff who moderate users and content, view statistics and configure the site.
- **Super administrators** — owners of the platform who additionally manage roles, pricing plans, payment credentials and account deletion.
- **External service providers** — Razorpay (payments), Google (sign-in) and an SMTP provider (e-mail), each optional.
- **Academic stakeholders** — the project guide and examiners evaluating the work.

## 1.11 Existing System Overview

Before QRSathi, the typical "system" used by the target users is a combination of: free online QR generators (often static-only, sometimes with expiring "dynamic" codes that require a paid plan), separate barcode generator websites, generic phone camera scanners, and spreadsheets for stock. Section 2.2 analyses this approach in detail. No claim is made in this report about the internal behaviour of any specific commercial product.

## 1.12 Proposed System Overview

QRSathi replaces the fragmented approach with one web application. Its verified modules are:

- **QR Generator and Design Studio** — 27 content types in five categories (essentials, payments, social, business, files & events), with colours, module shapes, logos, frames and export to PNG, JPG, SVG, PDF and ZIP.
- **Dynamic QR and hosted pages** — short links of the form `/r/{code}` and landing pages at `/p/{code}`, with pause, expiry, custom aliases, UTM parameters and scan analytics.
- **Barcode Generator** — 23 symbologies with validation and six label sizes.
- **Universal Scanner** — camera and image scanning in the browser with content classification and safety warnings, and an on-device scan history.
- **Products and Inventory** — product catalogue with multiple barcodes per product, stock in/out/adjust movements, low-stock flags and a per-product activity ledger.
- **Bulk tools** — batch QR and barcode generation and CSV/XLSX product import.
- **Administration console** — a separate sign-in at `/admin` with roles, MFA, user and content moderation, audit log, analytics, branding, pricing, e-mail and payment configuration.
- **Billing** — plans and entitlements stored in the database, with Razorpay subscription checkout and signed webhooks.

## 1.13 Advantages of the Proposed System

- One account and one data store for codes, products and stock.
- Printed dynamic QR codes remain correctable.
- Barcodes are validated (check digits, restricted-circulation ranges, per-user uniqueness) before being stored.
- Stock changes only through recorded movements, giving a complete history.
- Scanning happens on the user's device; images are not uploaded to a server.
- Scan analytics avoid storing raw IP addresses and honour Do-Not-Track signals.
- Administration is separated from the workspace and protected by MFA.
- The same code runs on SQLite (easy local set-up) and MySQL (production).

These are design advantages derived from the implementation; no comparative user study or benchmark was conducted.

## 1.14 Project Limitations

Limitations identified in the audit (detailed in Sections 6.24 and 7.4) include: uploaded files are stored on the local disk of a single server; uploads over 10 MB fail even where a plan allows more (defect D-01); e-mail addresses are not verified at sign-up; the in-memory rate limiter is per process unless the database store is enabled; there is no measured performance baseline; real Razorpay, Google and SMTP integrations were not exercised against live services in this audit; and a large part of the most recent work (billing, branding, pricing administration) was uncommitted in Git at the time of the audit.

## 1.15 Organization of the Report

- **Chapter 2 — System Analysis** analyses the existing approach, feasibility, stakeholders, requirements, roles, use cases, business rules and risks.
- **Chapter 3 — System Requirements** lists hardware and software requirements, detailed functional and non-functional requirements, the access-control matrix, configuration and the requirement traceability matrix.
- **Chapter 4 — System Design** presents the architecture, data-flow diagrams, flowcharts, database design, UML diagrams, UI, API and security design.
- **Chapter 5 — System Testing** reports the tests actually executed, test cases, results and defects.
- **Chapter 6 — Implementation and Evaluation** explains how each module is implemented, with code excerpts, set-up and deployment procedures and screenshots.
- **Chapter 7 — Conclusion and Future Enhancements** evaluates the objectives and proposes future work.
- **References and Appendices** provide sources, the directory structure, API inventory, data dictionary, test cases, installation guide, configuration reference, screenshot index, traceability matrix and glossary.
