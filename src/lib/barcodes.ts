/**
 * Barcode symbology registry: validation, check digits, rendering (bwip-js)
 * and lookup normalisation. Isomorphic — used by the UI, the API and tests.
 *
 * "scannable" means our in-app scanner (zxing-wasm) can read the format; it is
 * verified for every format by scripts/test-barcodes.mts.
 */
import bwipjs from "bwip-js/browser";
import { escapeXml } from "./utils";

export type BarcodeGroup = "retail" | "logistics" | "general" | "2d";

export interface ValidationOk {
  ok: true;
  value: string; // exact text handed to the encoder
  display: string; // human-friendly form
  warnings: string[];
}
export interface ValidationErr {
  ok: false;
  error: string;
}
export type BarcodeValidation = ValidationOk | ValidationErr;

export interface BarcodeFormatDef {
  id: string;
  label: string;
  bcid: string; // bwip-js encoder id
  group: BarcodeGroup;
  dims: "1d" | "2d";
  scannable: boolean;
  description: string;
  placeholder: string;
  example: string;
  /** Offered in the product barcode generator. */
  product?: boolean;
  /** Numeric GS1 identifier (GTIN-like) — needs legitimately allocated numbers for retail. */
  gtinLike?: boolean;
  bwip?: Record<string, unknown>;
  validate: (input: string) => BarcodeValidation;
}

// ---------- check digits ----------
/** GS1 mod-10 check digit for a body (without the check digit). */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w;
  return (10 - (sum % 10)) % 10;
}
export function isValidGs1(full: string) {
  return /^\d+$/.test(full) && gs1CheckDigit(full.slice(0, -1)) === Number(full.at(-1));
}

/** UPC-E (8 digits incl. number system and check) -> UPC-A (12 digits). */
export function upceToUpca(upce: string): string {
  const ns = upce[0], d = upce.slice(1, 7), check = upce[7] ?? "";
  const [d1, d2, d3, d4, d5, d6] = d.split("");
  let body: string;
  switch (d6) {
    case "0": case "1": case "2": body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`; break;
    case "3": body = `${d1}${d2}${d3}00000${d4}${d5}`; break;
    case "4": body = `${d1}${d2}${d3}${d4}00000${d5}`; break;
    default: body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }
  return `${ns}${body}${check}`;
}

function isbn10Valid(s: string) {
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === "X" ? 10 : Number(s[i])) * (10 - i);
  return sum % 11 === 0;
}
function issnCheck(seven: string) {
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(seven[i]) * (8 - i);
  const c = (11 - (sum % 11)) % 11;
  return c === 10 ? "X" : String(c);
}

const digitsOnly = (s: string) => s.replace(/[\s-]/g, "");
const ok = (value: string, display = value, warnings: string[] = []): ValidationOk => ({ ok: true, value, display, warnings });
const err = (error: string): ValidationErr => ({ ok: false, error });

/** Validates an n-digit GS1 number given as body (n-1) or full (n). */
function gs1Fixed(input: string, n: number, name: string): BarcodeValidation {
  const s = digitsOnly(input);
  if (!s) return err(`Enter ${n - 1} or ${n} digits`);
  if (!/^\d+$/.test(s)) return err(`${name} uses digits only`);
  if (s.length === n - 1) {
    const full = s + gs1CheckDigit(s);
    return ok(full, full, [`Check digit ${full.at(-1)} calculated automatically.`]);
  }
  if (s.length !== n) return err(`${name} needs ${n - 1} digits (+ check digit) — you entered ${s.length}`);
  const expected = gs1CheckDigit(s.slice(0, -1));
  if (expected !== Number(s.at(-1))) return err(`Invalid check digit: the last digit should be ${expected}, not ${s.at(-1)}`);
  return ok(s);
}

// ---------- GS1 Application Identifier strings ----------
const AI_NAMES: Record<string, string> = {
  "00": "SSCC (shipping container)", "01": "GTIN", "02": "GTIN of contained items", "10": "Batch / lot", "11": "Production date",
  "12": "Due date", "13": "Packaging date", "15": "Best before", "16": "Sell by", "17": "Expiry date", "20": "Variant", "21": "Serial number",
  "22": "Consumer product variant", "30": "Variable count", "37": "Count of trade items", "240": "Additional product ID", "241": "Customer part no.",
  "250": "Secondary serial", "400": "Customer order no.", "401": "Consignment no.", "402": "Shipment ID", "403": "Routing code",
  "410": "Ship-to GLN", "411": "Bill-to GLN", "412": "Purchased-from GLN", "413": "Ship-for GLN", "414": "Location GLN", "415": "Invoicing party GLN",
  "420": "Ship-to postal code", "422": "Country of origin", "7003": "Expiry date & time", "8008": "Production date & time", "8200": "Product URL",
};
export function aiName(ai: string) {
  if (AI_NAMES[ai]) return AI_NAMES[ai];
  if (/^310\d$/.test(ai)) return `Net weight (kg, ${ai[3]} decimals)`;
  if (/^320\d$/.test(ai)) return `Net weight (lb, ${ai[3]} decimals)`;
  if (/^330\d$/.test(ai)) return `Gross weight (kg, ${ai[3]} decimals)`;
  if (/^392\d$/.test(ai)) return `Price (${ai[3]} decimals)`;
  return `AI ${ai}`;
}

/** Parses "(01)0952…(10)ABC" into AI/value pairs. Returns null if not GS1 syntax. */
export function parseGs1(text: string): { ai: string; value: string; name: string }[] | null {
  const t = text.trim();
  if (!/^(\(\d{2,4}\)[^()]+)+$/.test(t)) return null;
  const out: { ai: string; value: string; name: string }[] = [];
  const re = /\((\d{2,4})\)([^()]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) out.push({ ai: m[1], value: m[2], name: aiName(m[1]) });
  return out;
}

const DATE_AIS = new Set(["11", "12", "13", "15", "16", "17"]);
function validateGs1String(input: string): BarcodeValidation {
  const t = input.trim().replace(/\s+/g, "");
  const parts = parseGs1(t);
  if (!parts) return err("Use GS1 element strings like (01)09521234543213(17)261231(10)LOT42 — AIs in brackets.");
  for (const p of parts) {
    if (p.ai === "01" || p.ai === "02") {
      if (!/^\d{14}$/.test(p.value)) return err(`(${p.ai}) GTIN must be 14 digits (pad shorter GTINs with leading zeros)`);
      if (!isValidGs1(p.value)) return err(`(${p.ai}) GTIN check digit should be ${gs1CheckDigit(p.value.slice(0, 13))}`);
    } else if (p.ai === "00") {
      if (!/^\d{18}$/.test(p.value) || !isValidGs1(p.value)) return err("(00) SSCC must be 18 digits with a valid check digit");
    } else if (DATE_AIS.has(p.ai)) {
      if (!/^\d{6}$/.test(p.value)) return err(`(${p.ai}) dates use YYMMDD, e.g. 261231`);
      const mm = Number(p.value.slice(2, 4)), dd = Number(p.value.slice(4, 6));
      if (mm < 1 || mm > 12 || dd > 31) return err(`(${p.ai}) ${p.value} isn't a valid YYMMDD date`);
    } else if (["10", "21", "22", "240", "241", "250", "400", "401", "403"].includes(p.ai)) {
      if (p.value.length > (p.ai === "401" || p.ai === "400" || p.ai === "403" ? 30 : 20)) return err(`(${p.ai}) value is too long`);
      if (!/^[!"%&'()*+,\-./0-9:;<=>?A-Z_a-z]+$/.test(p.value)) return err(`(${p.ai}) contains characters not allowed in GS1 (use letters, digits and basic punctuation)`);
    }
  }
  // GS1 "requisite AI" rule: product attributes need the item's identifier.
  const ais = new Set(parts.map((p) => p.ai));
  const attr = parts.find((p) => ["10", "11", "13", "15", "16", "17", "21", "22"].includes(p.ai) || /^3[1-6]\d\d$/.test(p.ai));
  if (attr && !["01", "02", "03", "8006", "8026"].some((a) => ais.has(a)))
    return err(`(${attr.ai}) ${aiName(attr.ai)} must be accompanied by a GTIN — add (01) followed by the 14-digit GTIN`);
  return ok(t, t);
}

/** Builds a GS1 element string from a product's GTIN, batch and expiry. */
export function buildGs1String(gtin: string, batch?: string, expiry?: string | Date | null) {
  const g = digitsOnly(gtin).padStart(14, "0");
  let s = `(01)${g}`;
  if (expiry) {
    const d = typeof expiry === "string" ? new Date(expiry) : expiry;
    if (!isNaN(d.getTime())) s += `(17)${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  if (batch?.trim()) s += `(10)${batch.trim()}`;
  return s;
}

const CODE39 = /^[0-9A-Z \-.$/+%]+$/;

// ---------- format registry ----------
export const BARCODE_FORMATS: BarcodeFormatDef[] = [
  {
    id: "ean13", label: "EAN-13", bcid: "ean13", group: "retail", dims: "1d", scannable: true, product: true, gtinLike: true,
    description: "Retail products worldwide (GTIN-13). India GS1 prefix: 890.", placeholder: "890123456789(0)", example: "5901234123457",
    validate: (s) => gs1Fixed(s, 13, "EAN-13"),
  },
  {
    id: "ean8", label: "EAN-8", bcid: "ean8", group: "retail", dims: "1d", scannable: true, product: true, gtinLike: true,
    description: "Small retail packs (GTIN-8).", placeholder: "9638507(4)", example: "96385074",
    validate: (s) => gs1Fixed(s, 8, "EAN-8"),
  },
  {
    id: "upca", label: "UPC-A", bcid: "upca", group: "retail", dims: "1d", scannable: true, product: true, gtinLike: true,
    description: "North American retail (GTIN-12).", placeholder: "03600029145(2)", example: "036000291452",
    validate: (s) => gs1Fixed(s, 12, "UPC-A"),
  },
  {
    id: "upce", label: "UPC-E", bcid: "upce", group: "retail", dims: "1d", scannable: true, product: true, gtinLike: true,
    description: "Zero-suppressed UPC for small packages. Only some UPC-A numbers can be compressed.", placeholder: "0123456(5)", example: "01234565",
    validate: (input) => {
      const s = digitsOnly(input);
      if (!/^[01]\d{6,7}$/.test(s)) return err("UPC-E is 7 digits (+ check digit) starting with 0 or 1");
      const body7 = s.slice(0, 7);
      const expected = gs1CheckDigit(upceToUpca(body7 + "0").slice(0, 11));
      if (s.length === 8 && Number(s[7]) !== expected) return err(`Invalid check digit: the last digit should be ${expected}`);
      const full = body7 + expected;
      return ok(full, full, s.length === 7 ? [`Check digit ${expected} calculated. Equivalent UPC-A: ${upceToUpca(full)}`] : [`Equivalent UPC-A: ${upceToUpca(full)}`]);
    },
  },
  {
    id: "isbn", label: "ISBN (book EAN)", bcid: "ean13", group: "retail", dims: "1d", scannable: true,
    description: "Books — ISBN-13 printed as EAN-13 (ISBN-10 converted automatically).", placeholder: "978-0-306-40615-7 or 0-306-40615-2", example: "9780306406157",
    validate: (input) => {
      const s = input.replace(/[\s-]/g, "").toUpperCase();
      if (/^\d{9}[\dX]$/.test(s)) {
        if (!isbn10Valid(s)) return err("Invalid ISBN-10 check digit");
        const body = "978" + s.slice(0, 9);
        const full = body + gs1CheckDigit(body);
        return ok(full, `ISBN ${full}`, [`Converted ISBN-10 ${s} to ISBN-13 ${full}.`]);
      }
      if (!/^97[89]\d{9,10}$/.test(s)) return err("ISBN-13 starts with 978 or 979 (13 digits), or enter a 10-character ISBN-10");
      const v = gs1Fixed(s, 13, "ISBN");
      return v.ok ? ok(v.value, `ISBN ${v.value}`, v.warnings) : v;
    },
  },
  {
    id: "issn", label: "ISSN (periodical EAN)", bcid: "ean13", group: "retail", dims: "1d", scannable: true,
    description: "Magazines & journals — ISSN encoded as EAN-13 with prefix 977.", placeholder: "0317-8471", example: "0317-8471",
    validate: (input) => {
      const s = input.replace(/[\s-]/g, "").toUpperCase().replace(/^ISSN/, "");
      if (!/^\d{7}[\dX]$/.test(s)) return err("ISSN is 8 characters, e.g. 0317-8471");
      if (issnCheck(s.slice(0, 7)) !== s[7]) return err(`Invalid ISSN check character — should be ${issnCheck(s.slice(0, 7))}`);
      const body = `977${s.slice(0, 7)}00`;
      const full = body + gs1CheckDigit(body);
      return ok(full, `ISSN ${s.slice(0, 4)}-${s.slice(4)}`, [`Encoded as EAN-13 ${full} (issue variant 00).`]);
    },
  },
  {
    id: "code128", label: "Code 128", bcid: "code128", group: "general", dims: "1d", scannable: true, product: true,
    description: "Compact, full-ASCII — best for internal SKUs, inventory and asset tags.", placeholder: "SKU-1042-BLU-M", example: "SKU-1042-BLU-M",
    validate: (s) => {
      if (!s) return err("Enter the text to encode");
      if (!/^[\x20-\x7e]+$/.test(s)) return err("Code 128 supports standard keyboard characters (ASCII) only");
      if (s.length > 80) return err("Keep Code 128 under 80 characters");
      return ok(s);
    },
  },
  {
    id: "gs1-128", label: "GS1-128", bcid: "gs1-128", group: "logistics", dims: "1d", scannable: true, product: true,
    description: "Logistics labels with GS1 data: GTIN, batch, expiry, SSCC…", placeholder: "(01)09521234543213(17)261231(10)LOT42", example: "(01)09521234543213(17)261231(10)LOT42",
    validate: validateGs1String,
  },
  {
    id: "code39", label: "Code 39", bcid: "code39", group: "general", dims: "1d", scannable: true, product: true,
    description: "Industrial/legacy systems. Uppercase A–Z, 0–9, space and - . $ / + %.", placeholder: "PART-7781", example: "PART-7781",
    validate: (s) => {
      if (!s) return err("Enter the text to encode");
      if (!CODE39.test(s)) return err(/[a-z]/.test(s) ? "Code 39 has no lowercase letters — use uppercase or choose Code 128" : "Code 39 allows A–Z, 0–9, space and - . $ / + % only");
      if (s.length > 43) return err("Keep Code 39 under 43 characters");
      return ok(s);
    },
  },
  {
    id: "code93", label: "Code 93", bcid: "code93", group: "general", dims: "1d", scannable: true, bwip: { includecheck: true },
    description: "Denser alternative to Code 39 (same character set).", placeholder: "ABC-123", example: "ABC-123",
    validate: (s) => {
      if (!s) return err("Enter the text to encode");
      if (!CODE39.test(s)) return err("Code 93 here allows A–Z, 0–9, space and - . $ / + % only");
      if (s.length > 40) return err("Keep Code 93 under 40 characters");
      return ok(s);
    },
  },
  {
    id: "codabar", label: "Codabar", bcid: "rationalizedCodabar", group: "general", dims: "1d", scannable: true,
    description: "Libraries, blood banks, couriers. Digits and - $ : / . + with A–D start/stop.", placeholder: "40156 or A40156B", example: "A40156B",
    validate: (input) => {
      let s = input.trim().toUpperCase();
      const added = !/^[A-D]/.test(s);
      if (added) s = `A${s}B`;
      if (!/^[A-D][0-9\-$:/.+]+[A-D]$/.test(s)) return err("Codabar allows digits and - $ : / . + between A–D start/stop letters");
      if (s.length > 40) return err("Too long for Codabar");
      return ok(s, s, added ? ["Start/stop characters A…B added."] : []);
    },
  },
  {
    id: "itf", label: "ITF (Interleaved 2 of 5)", bcid: "interleaved2of5", group: "logistics", dims: "1d", scannable: true,
    description: "Numeric, even number of digits — cartons and warehouses.", placeholder: "12345678", example: "12345678",
    validate: (input) => {
      const s = digitsOnly(input);
      if (!/^\d+$/.test(s)) return err("ITF encodes digits only");
      if (s.length % 2) return err("ITF needs an even number of digits — add a leading 0 if needed");
      if (s.length > 30) return err("Keep ITF under 30 digits");
      return ok(s);
    },
  },
  {
    id: "itf14", label: "ITF-14", bcid: "itf14", group: "logistics", dims: "1d", scannable: true, product: true, gtinLike: true,
    description: "Outer cartons / trade-item cases (GTIN-14).", placeholder: "1540014128876(3)", example: "15400141288763",
    validate: (s) => gs1Fixed(s, 14, "ITF-14"),
  },
  {
    id: "std2of5", label: "Standard 2 of 5", bcid: "code2of5", group: "logistics", dims: "1d", scannable: false,
    description: "Legacy industrial numeric code. Generate only — our scanner can't read it.", placeholder: "12345678", example: "12345678",
    validate: (input) => {
      const s = digitsOnly(input);
      if (!/^\d{1,30}$/.test(s)) return err("Standard 2 of 5 encodes 1–30 digits");
      return ok(s, s, ["Our in-app scanner cannot read Standard 2 of 5; test with your hardware scanner."]);
    },
  },
  {
    id: "msi", label: "MSI / Plessey", bcid: "msi", group: "logistics", dims: "1d", scannable: false, bwip: { includecheck: true },
    description: "Shelf labels in older retail systems (mod-10 check). Generate only.", placeholder: "1234567", example: "1234567",
    validate: (input) => {
      const s = digitsOnly(input);
      if (!/^\d{1,30}$/.test(s)) return err("MSI encodes 1–30 digits");
      return ok(s, s, ["A mod-10 check digit is appended. Our in-app scanner cannot read MSI; test with your hardware scanner."]);
    },
  },
  {
    id: "datamatrix", label: "Data Matrix", bcid: "datamatrix", group: "2d", dims: "2d", scannable: true,
    description: "Tiny 2D code for parts, pharma and electronics.", placeholder: "Any text", example: "PN:7781 SN:000123",
    validate: (s) => (!s ? err("Enter the text to encode") : s.length > 1500 ? err("Too long for one Data Matrix (max ~1500 characters)") : ok(s)),
  },
  {
    id: "gs1datamatrix", label: "GS1 DataMatrix", bcid: "gs1datamatrix", group: "2d", dims: "2d", scannable: true, product: true,
    description: "Healthcare & traceability with GS1 data (GTIN, batch, expiry, serial).", placeholder: "(01)09521234543213(17)261231(10)LOT42", example: "(01)09521234543213(17)261231(10)LOT42",
    validate: validateGs1String,
  },
  {
    id: "pdf417", label: "PDF417", bcid: "pdf417", group: "2d", dims: "2d", scannable: true,
    description: "Stacked 2D code — IDs, boarding passes, shipping documents.", placeholder: "Any text", example: "INV-2026-0042|Qty 12|Ship 28-10-2026",
    validate: (s) => (!s ? err("Enter the text to encode") : s.length > 1000 ? err("Keep PDF417 under 1000 characters") : ok(s)),
  },
  {
    id: "aztec", label: "Aztec", bcid: "azteccode", group: "2d", dims: "2d", scannable: true,
    description: "Compact 2D code used on tickets and transport passes.", placeholder: "Any text", example: "TICKET-8812-A",
    validate: (s) => (!s ? err("Enter the text to encode") : s.length > 1500 ? err("Too long for one Aztec code") : ok(s)),
  },
  {
    id: "microqr", label: "Micro QR", bcid: "microqrcode", group: "2d", dims: "2d", scannable: true,
    description: "Very small QR variant for short data (up to ~35 digits or ~21 letters).", placeholder: "12345", example: "A1B2C3",
    validate: (s) => (!s ? err("Enter the text to encode") : s.length > 35 ? err("Micro QR holds at most 35 digits / 21 alphanumeric characters") : ok(s)),
  },
  {
    id: "gs1qr", label: "GS1 QR Code", bcid: "gs1qrcode", group: "2d", dims: "2d", scannable: true,
    description: "QR Code carrying GS1 element strings.", placeholder: "(01)09521234543213(10)LOT42", example: "(01)09521234543213(10)LOT42",
    validate: validateGs1String,
  },
];

export const BARCODE_MAP: Record<string, BarcodeFormatDef> = Object.fromEntries(BARCODE_FORMATS.map((f) => [f.id, f]));
export const PRODUCT_FORMATS = BARCODE_FORMATS.filter((f) => f.product);
export const BARCODE_GROUPS: { id: BarcodeGroup; label: string }[] = [
  { id: "retail", label: "Retail & books" },
  { id: "general", label: "Inventory & general" },
  { id: "logistics", label: "Shipping & cartons" },
  { id: "2d", label: "2D codes" },
];

export function getBarcodeFormat(id: string | null | undefined) {
  return (id && BARCODE_MAP[id]) || BARCODE_MAP.code128;
}

export function validateBarcode(formatId: string, input: string): BarcodeValidation {
  const f = BARCODE_MAP[formatId];
  if (!f) return err("Unknown barcode format");
  return f.validate(input ?? "");
}

// ---------- rendering ----------
export interface BarcodeRenderOptions {
  scale?: number; // module width (1D) / module size (2D) in SVG units
  heightMm?: number; // bar height for 1D codes
  showText?: boolean;
  margin?: number; // quiet zone, in modules
  color?: string; // hex without #
  background?: string; // hex without # (omit for transparent)
}

/** Renders a barcode to SVG. Throws with a readable message if the encoder rejects the data. */
export function renderBarcodeSvg(formatId: string, value: string, o: BarcodeRenderOptions = {}): string {
  const f = getBarcodeFormat(formatId);
  const margin = o.margin ?? 10;
  const opts: Record<string, unknown> = {
    bcid: f.bcid,
    text: value,
    scale: o.scale ?? 2,
    includetext: f.dims === "1d" ? o.showText ?? true : false,
    paddingwidth: margin,
    paddingheight: f.dims === "1d" ? Math.round(margin / 2) : margin,
    barcolor: (o.color || "000000").replace("#", ""),
    ...(o.background ? { backgroundcolor: o.background.replace("#", "") } : {}),
    ...(f.dims === "1d" ? { height: o.heightMm ?? 15 } : {}),
    ...f.bwip,
  };
  try {
    return (bwipjs as any).toSVG(opts) as string;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(friendlyBwipError(msg));
  }
}

function friendlyBwipError(msg: string) {
  const m = /^bwipp\.(\w+?)(?:#\d+)?: (.*)$/.exec(msg);
  return m ? m[2] : msg.replace(/^Error: /, "");
}

/** Parses width/height/viewBox from an SVG string. */
export function svgSize(svg: string) {
  const vb = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1]?.trim().split(/\s+/).map(Number);
  const w = vb ? vb[2] : Number(/width="([\d.]+)/.exec(svg)?.[1] || 100);
  const h = vb ? vb[3] : Number(/height="([\d.]+)/.exec(svg)?.[1] || 100);
  return { width: w, height: h, viewBox: vb ? vb.join(" ") : `0 0 ${w} ${h}` };
}

/** Returns the inner markup of an SVG (without the outer <svg> element). */
export function svgInner(svg: string) {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

// ---------- labels ----------
export type LabelLayout = "barcode" | "product" | "shelf" | "compact";
export interface LabelData {
  name?: string;
  variant?: string;
  price?: string; // already formatted, e.g. "₹ 199.00"
  sku?: string;
  extra?: string; // e.g. "MFG: … | BATCH: …"
}
export interface LabelSize {
  id: string;
  label: string;
  w: number; // mm
  h: number; // mm
}
export const LABEL_SIZES: LabelSize[] = [
  { id: "50x25", label: "50 × 25 mm (common thermal)", w: 50, h: 25 },
  { id: "38x25", label: "38 × 25 mm (small)", w: 38, h: 25 },
  { id: "62x29", label: "62 × 29 mm (Brother DK)", w: 62, h: 29 },
  { id: "70x35", label: "70 × 35 mm", w: 70, h: 35 },
  { id: "100x50", label: "100 × 50 mm (shipping)", w: 100, h: 50 },
  { id: "100x150", label: "100 × 150 mm (4×6 carton)", w: 100, h: 150 },
];

const FONT = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Composes a printable label (mm-based viewBox, 10 units per mm) around a
 * barcode SVG. Text is clipped to fit; the barcode keeps its aspect ratio.
 */
export function renderLabelSvg(barcodeSvg: string, layout: LabelLayout, size: { w: number; h: number }, data: LabelData = {}) {
  const W = size.w * 10, H = size.h * 10, pad = 15;
  const { width: bw, height: bh, viewBox } = svgSize(barcodeSvg);
  const inner = svgInner(barcodeSvg);
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#ffffff"/>`];
  const text = (t: string, x: number, y: number, fs: number, weight = 600, anchor = "middle", maxW = W - pad * 2) => {
    const fit = Math.min(fs, maxW / Math.max(1, t.length * 0.58));
    return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${fit.toFixed(1)}" font-weight="${weight}" fill="#000" text-anchor="${anchor}" dominant-baseline="central">${escapeXml(t)}</text>`;
  };
  const place = (x: number, y: number, w: number, h: number) => {
    // fit barcode into box, keep aspect ratio
    const s = Math.min(w / bw, h / bh);
    const dw = bw * s, dh = bh * s;
    parts.push(`<svg x="${(x + (w - dw) / 2).toFixed(1)}" y="${(y + (h - dh) / 2).toFixed(1)}" width="${dw.toFixed(1)}" height="${dh.toFixed(1)}" viewBox="${viewBox}">${inner}</svg>`);
  };
  let y = pad;
  if (layout === "barcode") {
    place(pad, pad, W - pad * 2, H - pad * 2);
  } else if (layout === "shelf") {
    const fsName = Math.min(40, H * 0.13);
    if (data.name) { parts.push(text(data.name, W / 2, y + fsName / 2, fsName, 700)); y += fsName + 6; }
    const fsPrice = Math.min(90, H * 0.28);
    if (data.price) { parts.push(text(data.price, W / 2, y + fsPrice / 2, fsPrice, 800)); y += fsPrice + 6; }
    place(pad, y, W - pad * 2, H - y - pad);
  } else if (layout === "compact") {
    const fs = Math.min(30, H * 0.12);
    if (data.name) { parts.push(text(data.name, W / 2, y + fs / 2, fs, 700)); y += fs + 4; }
    place(pad, y, W - pad * 2, H - y - pad);
  } else {
    const fsName = Math.min(38, H * 0.12), fsSmall = Math.min(26, H * 0.085);
    if (data.name) { parts.push(text(data.name, W / 2, y + fsName / 2, fsName, 700)); y += fsName + 4; }
    if (data.variant) { parts.push(text(data.variant, W / 2, y + fsSmall / 2, fsSmall, 500)); y += fsSmall + 4; }
    const footer = (data.price || data.sku ? fsName + 6 : 0) + (data.extra ? fsSmall + 4 : 0);
    place(pad, y, W - pad * 2, H - y - pad - footer);
    let fy = H - pad - (data.extra ? fsSmall + 4 : 0);
    if (data.price || data.sku) {
      if (data.price) parts.push(text(data.price, pad, fy - fsName / 2, fsName, 800, "start", (W - pad * 2) / 2));
      if (data.sku) parts.push(text(data.sku, W - pad, fy - fsSmall / 2, fsSmall, 500, "end", (W - pad * 2) / 2));
    }
    if (data.extra) { fy = H - pad; parts.push(text(data.extra, W / 2, fy - fsSmall / 2, fsSmall * 0.9, 500)); }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}mm" height="${size.h}mm" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

// ---------- lookup normalisation ----------
/**
 * Canonical key used to match scanned codes to saved products. GTIN-family
 * numbers (EAN-8/13, UPC-A/E, ITF-14, GS1 (01)) collapse to a 14-digit GTIN so
 * a UPC-A label scanned as EAN-13 (leading 0) still matches.
 */
export function lookupKey(formatId: string, value: string): string {
  const v = value.trim();
  if (formatId === "upce" && /^[01]\d{7}$/.test(v)) return upceToUpca(v).padStart(14, "0");
  if (["ean13", "ean8", "upca", "itf14", "isbn", "issn"].includes(formatId) && /^\d{8,14}$/.test(v)) return v.padStart(14, "0");
  const gs1 = parseGs1(v);
  const gtin = gs1?.find((p) => p.ai === "01")?.value;
  if (gtin) return gtin;
  return v;
}

/** Candidate lookup keys for raw scanned text (format unknown or from the scanner). */
export function scanLookupKeys(text: string, scannerFormat?: string): string[] {
  const t = text.trim();
  const keys = new Set<string>([t]);
  const d = t.replace(/^\][A-Za-z]\d/, "");
  if (/^\d{8}$/.test(d) && scannerFormat === "UPCE") keys.add(upceToUpca(d).padStart(14, "0"));
  if (/^\d{8,14}$/.test(d) && isValidGs1(d)) keys.add(d.padStart(14, "0"));
  if (/^\d{13}$/.test(d) && scannerFormat === "UPCE") keys.add(d.padStart(14, "0"));
  const gtin = parseGs1(d)?.find((p) => p.ai === "01")?.value;
  if (gtin) keys.add(gtin);
  return [...keys];
}

/** Internal numbers use GS1 "restricted circulation" prefixes (20–29), never real GTIN ranges. */
export function generateInternalNumber(formatId: string, rand: () => number = Math.random): string {
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join("");
  switch (formatId) {
    case "ean13": { const body = `2${Math.floor(rand() * 10)}${digits(10)}`; return body + gs1CheckDigit(body); }
    case "ean8": { const body = `2${digits(6)}`; return body + gs1CheckDigit(body); }
    case "upca": { const body = `2${digits(10)}`; return body + gs1CheckDigit(body); }
    case "code39": return `INT-${digits(8)}`;
    default: {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      return `INT-${Array.from({ length: 8 }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("")}`;
    }
  }
}

export function isRestrictedCirculation(formatId: string, value: string) {
  if (formatId === "ean13") return /^2\d{12}$/.test(value);
  if (formatId === "ean8") return /^2\d{7}$/.test(value);
  if (formatId === "upca") return /^[24]\d{11}$/.test(value);
  return false;
}
