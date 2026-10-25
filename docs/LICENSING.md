# Choosing a licence (decision needed from the owner)

**There is no LICENSE file yet, on purpose.** Without one, the code is "all rights reserved": people can read it on GitHub, but they aren't allowed to use, copy or modify it.

The owner (Druve Media) has to pick a licence before publishing. Nobody else can make that choice, because it decides what competitors and customers may legally do with the code. This document is not legal advice. For a commercial product, have a lawyer confirm the choice.

## The three realistic options

| | **MIT** | **Apache-2.0** | **AGPL-3.0** |
|---|---|---|---|
| Others may use it commercially | Yes | Yes | Yes, but… |
| Others may run a modified copy as a closed-source SaaS | **Yes** | **Yes** | **No.** They must publish their modified source to their users. |
| Patent grant from contributors | Implicit/unclear | **Explicit**, with patent-retaliation clause | Explicit |
| Trademark protection ("QRSathi" name/logo) | No | **Explicitly not granted** | Not granted |
| Notice requirements | Keep copyright notice | Keep notices + NOTICE file + mark changes | Keep notices; share source of modifications |
| Adoption by companies | Highest | High (many enterprises prefer it) | Lower (many companies forbid AGPL) |
| Lets *you* sell a proprietary/commercial edition | Yes | Yes | Only if you own all copyrights (requires a CLA from contributors) |

## Which fits which goal

- **"We want maximum adoption, and we're fine if others build businesses on it."** → **Apache-2.0**. It is as permissive as MIT, adds an explicit patent licence, and says clearly that it grants no trademark rights. Your "QRSathi" brand stays yours even though the code is open.
- **"We run QRSathi as our own commercial SaaS and don't want a competitor to host our code as a closed fork."** → **AGPL-3.0**, ideally with a Contributor License Agreement (CLA). The CLA keeps your right to also sell a commercial licence (dual licensing). Expect fewer outside contributors.
- **"Simplest possible."** → **MIT**. Same freedoms as Apache-2.0, but no explicit patent or trademark language.

**Recommendation for owner approval:**
- If the plan is a commercial hosted service where the code itself is a competitive asset, choose **AGPL-3.0 + CLA**.
- If the plan is community growth and services or hosting revenue, choose **Apache-2.0**.

Either way, register or protect the **QRSathi** name and logo separately. Open-source licences don't stop others from using your *code*, and only trademark law controls your *brand*.

## After choosing

1. Add the official licence text as `LICENSE` in the repository root, with `Copyright (c) 2026 Druve Media`.
2. Set `"license": "Apache-2.0"` (or `"AGPL-3.0-only"` / `"MIT"`) in `package.json`. Keep `"private": true`, which only prevents accidental npm publishing.
3. Update the "Licence" section of `README.md`.
4. For AGPL with dual licensing, add a CLA (for example, the CLA Assistant GitHub app) before accepting outside pull requests.

## Third-party licences (audit, 2026-10-25)

`node scripts/license-report.mjs` lists every production dependency and fails CI on new copyleft licences.

| Licence | Packages |
|---|---|
| MIT | 137 |
| ISC | 23 |
| Apache-2.0 | 13 |
| BSD-3-Clause / BSD-2-Clause / 0BSD / MIT-0 | 8 |
| MIT AND Zlib (pako) | 2 |
| Dual: MIT OR GPL-3.0 (jszip), MPL-2.0 OR Apache-2.0 (dompurify), MIT OR CC0 | used under the permissive option |
| CC0-1.0 (`simple-icons`: social brand marks, see below) | 1 |
| CC-BY-4.0 (caniuse-lite: browser-support data used at build time) | 1 |
| LGPL-3.0-or-later (`@img/sharp-*` → libvips, optional dependency of Next.js image optimisation) | Dynamically loaded native library. LGPL allows use in commercial/proprietary apps; keep its licence notice. |

All of these allow commercial use. None forces QRSathi's own code to be released under a particular licence.

### Bundled assets

| Asset | Source | Licence |
|---|---|---|
| `public/zxing/zxing_reader.wasm` | Copied at install time from `zxing-wasm` (ZXing-C++) | MIT (wrapper) / Apache-2.0 (ZXing-C++) |
| Inter font | `next/font/google`, downloaded and self-hosted at build time | SIL Open Font License 1.1 |
| Icons | `lucide-react` | ISC |
| Social brand marks (Instagram, Facebook, WhatsApp, YouTube, TikTok, X, Telegram, Snapchat, Spotify, Google Maps, Threads, Pinterest, GitHub) | `simple-icons` 16.35.0, imported individually in `src/lib/brand-icons.ts` | Path data CC0-1.0; the marks themselves are **trademarks** of their owners |
| LinkedIn "in" glyph | Drawn for this project (`simple-icons` no longer ships LinkedIn) | Owned by Druve Media; LinkedIn is a trademark of LinkedIn Corporation |
| `src/app/icon.svg`, logo mark (`src/components/brand.tsx`) | Project's own artwork | Owned by Druve Media |

No stock photos or payment brand logos (UPI, Google Pay, PhonePe, Paytm and so on) are bundled; payment-app names appear only as text.

Social brand marks are used only to identify where a QR code or footer link leads (the type picker, social QR types, optional centre logos and the footer's configured social links). They don't imply endorsement. The CC0 licence covers the SVG path data, not trademark rights: before printing a brand's mark on marketing material, check that brand's guidelines (several ask for unmodified colours and clear space). Before adding any other logo, check its usage guidelines too.
