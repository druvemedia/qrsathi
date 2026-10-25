# QRSathi — Database Design

Derived from `prisma/schema.prisma` (canonical, SQLite provider) and `prisma/mysql/schema.prisma` (generated MySQL schema) with the migrations in `prisma/mysql/migrations/`. No database contents were read.

## 1. Overview

- **ORM:** Prisma 6.19.3. **Databases:** SQLite (development, `prisma db push`), MySQL 8 (production target, `prisma migrate deploy` with two migrations: `20261025000000_init`, `20261025180000_billing_branding`).
- **22 models.** 15 are connected by foreign keys; 7 are standalone.
- **Keys:** CUID string primary keys (except `PricingPlan.id`, `Setting.key`, `RateLimit.key`).
- **Tenancy:** almost all business rows carry `userId` and cascade on user deletion.
- **Money:** integer minor units (paise). **JSON:** stored as text and validated by zod in the application.

## 2. Diagrams

| Figure | File |
|---|---|
| Conceptual model | `diagrams/conceptual-model.mmd` → `diagrams/rendered/conceptual-model.png` |
| ER overview | `diagrams/database-erd.mmd` |
| Accounts, sessions, QR and analytics | `diagrams/erd-accounts-qr.mmd` |
| Products, barcodes and inventory | `diagrams/erd-inventory.mmd` |
| Pricing, subscriptions and payments | `diagrams/erd-billing.mmd` |

![ER overview](diagrams/rendered/database-erd.png)

## 3. Model summary

[[MODEL_SUMMARY]]

## 4. Relationships

| Parent | Child | Cardinality | FK | On delete |
|---|---|---|---|---|
| User | Session, MfaRecoveryCode, PasswordReset | 1:N | `userId` | Cascade |
| User | QrCode, Download, Upload | 1:N | `userId` | Cascade |
| User | Product, Barcode, InventoryTransaction | 1:N | `userId` | Cascade |
| User | Subscription, Payment | 1:N | `userId` | Cascade |
| QrCode | Scan | 1:N | `qrId` | Cascade |
| QrCode | Download | 0..1:N | `qrId` (nullable) | SetNull |
| Product | Barcode, InventoryTransaction | 1:N | `productId` | Cascade |
| Subscription | Payment | 0..1:N | `subscriptionId` (nullable) | SetNull |
| PricingPlan | ProviderPlan | 1:N | `planId` | Restrict |

Standalone: AbuseReport, WebhookEvent, BrandAsset, Log, Setting, AuditLog, RateLimit (they must outlive users or are global).

## 5. Constraints and indexes

| Model | Constraint / index | Purpose |
|---|---|---|
| User | `email` UNIQUE, `googleId` UNIQUE | Identity |
| QrCode | `shortCode` UNIQUE; `@@index([userId])` | Global short-link namespace; list per user |
| Scan | `@@index([qrId, createdAt])` | Analytics by time |
| Product | `@@unique([userId, sku])`; `@@index([userId, status])`; `@@index([userId, category])` | Per-user SKU; filtered lists |
| Barcode | `@@unique([userId, format, value])`; `@@index([userId, lookupKey])`; `@@index([productId])` | Per-user barcode uniqueness; scan lookup |
| InventoryTransaction | `@@index([productId, createdAt])`; `@@index([userId, createdAt])` | Ledger reads |
| Payment | `providerRef` UNIQUE; `@@index([userId, createdAt])`; `@@index([subscriptionId])` | Idempotency |
| Subscription | `providerSubscriptionId` UNIQUE; `@@index([userId, status])` | Provider mapping; live subscription lookup |
| ProviderPlan | `providerPlanId` UNIQUE; `@@index([planId, interval, mode, active])` | Checkout lookup |
| WebhookEvent | `@@unique([provider, eventId])`; `@@index([receivedAt])` | Duplicate delivery detection |
| Session | `@@index([userId])`; `@@index([expiresAt])` | Revocation; clean-up |
| MfaRecoveryCode | `codeHash` UNIQUE; `@@index([userId])` | One-time codes |
| PasswordReset | `tokenHash` UNIQUE | Token by hash |
| AuditLog | `@@index([createdAt])`, `([action])`, `([actorId])` | Filtering |
| BrandAsset | `storedName` UNIQUE; `@@index([kind, createdAt])` | Asset serving |
| Upload | `storedName` UNIQUE | File serving |
| Log / RateLimit | `@@index([createdAt])` / `@@index([resetAt])` | Paging / expiry |

## 6. Normalisation

- **1NF:** single values per column at database level; JSON text columns (`QrCode.content/design/utm`, `PricingPlan.features/limits`, `AuditLog.details`, branding in `Setting.value`) are deliberately opaque documents.
- **2NF:** single-column keys → no partial dependencies.
- **3NF:** holds except intentional, documented denormalisation: payment/subscription **snapshots** of plan name/amount; `InventoryTransaction.balance` (immutable ledger); `Product.stock` (cached sum of movements, updated atomically); `Barcode.userId` (enables per-user unique constraint).

## 7. SQLite vs MySQL

| Aspect | SQLite (dev) | MySQL (prod) | Handling |
|---|---|---|---|
| Schema management | `prisma db push` | Versioned migrations | `npm run db:mysql:schema` generates MySQL schema; CI check |
| Long strings | TEXT by default | `VARCHAR(191)` default | Explicit `@db.Text`, `@db.MediumText`, `@db.VarChar(n)` in generated schema |
| Case sensitivity | Binary comparisons for `=` | Case-insensitive default collation | Identifier columns kept distinct (tested: short codes `AbC` vs `abc`) |
| Foreign keys | Enforced by Prisma/SQLite | `relationMode = "foreignKeys"` | — |
| Concurrency | Database-level write lock | Row locks | `quotaLock` row update serialises quota checks on both |
| Data migration | — | `npm run db:migrate-data` | Pre-flight checks, refuses non-empty target, verification |

**Verification:** `npm run test:mysql` passed 32/32 against MySQL 8.4 (migrations, edge-case round-trip, case-sensitive IDs, case-insensitive search, safe failures).

## 8. Data dictionary

[[DATA_DICTIONARY]]
