# Screenshot checklist

## Captured (real, unmodified)

All files in `desktop-1280/` (47) and `mobile-375/` (47) were captured automatically by `scripts/test-browser.mts` (`SHOT_DIR`) from the production build during the final audit run on 2026-10-25 (18:41–18:47 IST), using throw-away accounts on an empty database. `mobile-montage.png` combines three of the mobile captures (home, generator, scanner) side by side for Figure 6.19. The full index is Appendix G of the report.

Known characteristics:
- Workspace pages (dashboard, products, inventory, analytics, codes, dynamic) show a **new, empty account**.
- Admin pages show a test administrator (`ui-admin-…@example.com`) **without MFA**, so the "Two-factor authentication is not enabled" banner is visible.
- `admin_subscriptions.png`, `admin_payments.png` and `admin_settings_pricing.png` were captured in the final run where these pages had browser-test findings (D-03/D-04); the images themselves render correctly at 1280 px.

## Recommended additional screenshots (capture manually, not fabricated)

These would strengthen a viva presentation but could not be produced automatically with meaningful data:

| # | Screen | How to capture |
|---|---|---|
| 1 | Generator with a styled QR (logo, frame, gradient) | `/generator` → Design tab → add logo and frame |
| 2 | Saved QR library with several codes | Save 3–4 codes, open `/codes` |
| 3 | Analytics with real scans | Scan a dynamic QR from a phone a few times, open `/analytics/<id>` |
| 4 | Dynamic QR edit dialog and paused/expired 410 page | `/dynamic` → edit/pause; open `/r/<code>` |
| 5 | Hosted landing page (menu or links) | Create a Menu/Links QR, open `/p/<code>` on a phone |
| 6 | Barcode label sheet PDF | `/barcodes` → label layout → download PDF |
| 7 | Product with barcodes and stock history | Create a product, record in/out/adjust, open `/products/<id>` |
| 8 | Low-stock list | Set stock ≤ low-stock level, open `/inventory` |
| 9 | Bulk generation result | `/bulk` → upload a CSV → download ZIP |
| 10 | Scanner decoding a live code (camera) | `/scanner` on a phone over HTTPS |
| 11 | Admin MFA enrolment with QR code | `/admin/mfa` (blur the secret and recovery codes before sharing) |
| 12 | Razorpay test-mode checkout | Requires a Razorpay test account |

Before sharing any manual screenshot, remove or blur e-mail addresses, secrets, recovery codes and personal data.
