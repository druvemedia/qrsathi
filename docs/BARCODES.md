# Barcodes, scanner, inventory and QR rendering

## QR rendering

`src/lib/qr-render.ts` is a pure SVG renderer on top of the `qrcode` encoder, so it runs identically in the browser and on Node. It supports square, rounded, dots, diamond, fluid and bar modules; square, rounded, circle and leaf eyes; linear and radial gradients; logo knock-out with automatic ECC-H; frames with captions; text above and below; background patterns; and a configurable quiet zone. Function patterns (timing and alignment) always stay solid so decorative styles keep scanning.

In the browser, every design change is rasterised and decoded with **jsQR**. The preview shows "Scan test passed" only when the decoded text matches the payload exactly. Exports: PNG, JPG and SVG up to 4096 px, PDF at 300 DPI (A4/A5/A6/Letter, single or sticker sheet), ZIP for bulk, and A4/A5 posters and standees.

## Barcodes, scanner & inventory

| Area | Route | Key code |
|---|---|---|
| Unified generator (QR \| Barcode tabs) | `/generator`, `/barcodes` | `src/components/generator-tabs.tsx`, `src/components/barcode/*` |
| Barcode formats, validation, check digits, labels | — | `src/lib/barcodes.ts` |
| Universal scanner | `/scanner` | `src/app/(app)/scanner/scanner.tsx`, `src/lib/zxing-client.ts`, `src/lib/scan-classify.ts`, `src/lib/scan-merge.ts` |
| Scan history (this device) | `/scan-history` | `src/lib/scan-history.ts` |
| Products (list, editor, import/export, bulk labels) | `/products`, `/products/new`, `/products/[id]` | `src/lib/products.ts`, `src/app/api/products/*` |
| Inventory dashboard | `/inventory` | `src/app/api/inventory/route.ts` |
| Bulk barcodes & labels | `/bulk?mode=barcode` | `src/app/(app)/bulk/barcode-bulk.tsx` |

**Libraries:**
- [`bwip-js`](https://github.com/metafloor/bwip-js) 4.x, the JavaScript port of BWIPP, generates every barcode as SVG/PNG in the browser and in Node.
- [`zxing-wasm`](https://github.com/Sec-ant/zxing-wasm) 3.x, ZXing-C++ compiled to WebAssembly, decodes codes in the browser. Its `.wasm` file is served from `/zxing/` (copied by `scripts/copy-wasm.mjs`), never from a CDN.
- `read-excel-file` / `write-excel-file` / `papaparse` handle CSV/XLSX.

### Supported formats (each verified by the test suites)

| Format | Generate | Scan in app | Notes |
|---|:-:|:-:|---|
| QR Code (all 26 content types, UPI) | ✅ | ✅ | Existing QR generator + studio |
| Micro QR | ✅ | ✅ | Up to ~35 digits / 21 characters |
| GS1 QR Code | ✅ | ✅ | GS1 element strings |
| EAN-13 / EAN-8 | ✅ | ✅ | Check digit validated or calculated |
| UPC-A / UPC-E | ✅ | ✅ | UPC-E check via UPC-A expansion; scans normalise to the same GTIN |
| ISBN (EAN-13, ISBN-10 converted) | ✅ | ✅ | |
| ISSN (EAN-13 with 977 prefix) | ✅ | ✅ | |
| Code 128 | ✅ | ✅ | Full printable ASCII |
| GS1-128 | ✅ | ✅ | AI syntax, GTIN/SSCC check digits, dates, requisite-AI rule |
| Code 39 / Code 93 | ✅ | ✅ | Uppercase set; Code 93 includes its mandatory check characters |
| Codabar | ✅ | ✅ | A–D start/stop added if missing |
| ITF (Interleaved 2 of 5) / ITF-14 | ✅ | ✅ | ITF needs an even number of digits |
| Data Matrix / GS1 DataMatrix | ✅ | ✅ | |
| PDF417 | ✅ | ✅ | |
| Aztec | ✅ | ✅ | |
| Standard 2 of 5 | ✅ | ❌ | **Generate only.** zxing has no reader for it; use a hardware scanner |
| MSI / Plessey | ✅ | ❌ | **Generate only**, same reason |

The scanning engine can also detect GS1 DataBar, MaxiCode and rMQR, but the test suites don't cover those formats, so they aren't advertised.

### GTINs: internal vs official

EAN/UPC/ITF-14 numbers sold through retail must be **GTINs allocated to your company by GS1** (GS1 India for Indian companies). QRSathi never claims to issue them:
- **Internal** numbers it generates use the GS1 restricted-circulation prefix **2** (20–29), valid only inside your own shop or warehouse. The server rejects an "internal" EAN/UPC outside that range.
- **Existing** barcodes (already printed by a manufacturer) and **GS1-allocated** GTINs are stored with their source, so the UI shows which is which.

### Inventory rules
- Scanning never changes stock. Only explicit **Stock in / Stock out / Adjust** actions do.
- Stock out can't go below zero, and movements are atomic.
- Every create, edit, archive, restore and movement is written to `InventoryTransaction` (the activity history).
- SKUs are unique per user. Barcodes are unique per user by canonical lookup key, so a UPC-A and its EAN-13 form count as the same code.
- Products are archived, not deleted. Permanent deletion is only possible after archiving.
- Product counts follow plan limits: Free 100, Pro 5,000, Business 50,000. Import row limits follow the plan's bulk limit.

### Scanner behaviour & limitations
- Camera access needs **HTTPS** (or `localhost`) and permission. The UI explains insecure-context, denied-permission and no-camera cases.
- Front/rear switching and a camera picker are available. **Flashlight and zoom** appear only when the browser exposes them (mostly Chrome on Android); desktop webcams usually don't.
- 1D barcodes must decode identically in **two consecutive frames** before they're shown, which guards against single-frame misreads. 2D codes are accepted immediately because they carry error correction.
- Uploaded images are decoded in a full pass plus overlapping strips. Strip results only fill gaps; they never replace a full-pass read. This catches codes such as a PDF417 that ZXing's multi-symbol search misses when several codes share an image.
- Decoding is fully on-device. Scan history lives in the browser's localStorage (max 500 entries), so camera scanning never writes to the database. A product lookup is a read-only GET.
- Very small, blurred, curved or glossy codes may not decode. Damaged 1D barcodes have no error correction.

### Database changes (additive)
`prisma/schema.prisma` gains three models; no existing tables or columns were removed or changed:
- `Product`: name, SKU (`@@unique([userId, sku])`), product ID, brand, category, variant, description, manufacturer, image URL, price in minor units + currency, stock, low-stock level, batch, expiry, status (`active`/`archived`).
- `Barcode`: format, exact value, canonical `lookupKey`, source (`internal`/`assigned`/`existing`), primary flag. Constraints `@@unique([userId, format, value])` and `@@index([userId, lookupKey])`.
- `InventoryTransaction`: type, signed quantity, balance after, note, reference.
- `User` gets the matching relations. Applied with `npx prisma db push`, which is additive for these changes.

## Static vs dynamic

- **Static:** content is encoded directly. No account needed. Works offline, can't change.
- **Dynamic:** encodes `{APP_URL}/r/{code}` → 302 to the current destination (with optional UTM tags). Can be edited, paused, given an expiry (Pro+) or a custom alias (Pro+). **It depends on this server and domain staying online.**
- **Hosted pages** (multi-link, menu, business profile, coupon, product, app, feedback, custom landing): served at `{APP_URL}/p/{code}`, editable any time.
