/**
 * Barcode test suite (no server needed):
 *  - check-digit maths (EAN/UPC/ITF-14/ISBN/ISSN/UPC-E)
 *  - valid + invalid input for every format
 *  - render every format to SVG and PNG, decode the PNG with zxing-wasm
 *    (the same decoder the in-app scanner uses) and compare to the input
 *  - labels stay scannable; multiple codes in one image; PDF export
 *  - QR + UPI QR from the existing renderer decode with the new scanner
 * Run: npm run test:barcodes
 */
import sharp from "sharp";
import bwipjs from "bwip-js/node";
import { readBarcodes } from "zxing-wasm/reader";
import { jsPDF } from "jspdf";
import {
  BARCODE_FORMATS, gs1CheckDigit, isValidGs1, upceToUpca, validateBarcode, renderBarcodeSvg, renderLabelSvg,
  lookupKey, scanLookupKeys, generateInternalNumber, isRestrictedCirculation, parseGs1, buildGs1String,
} from "../src/lib/barcodes";
import { renderQr, DEFAULT_DESIGN } from "../src/lib/qr-render";
import { mergeResults, offsetResult, stripRects } from "../src/lib/scan-merge";
import { buildUpiUri } from "../src/lib/upi";

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, info = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && info ? `  → ${info}` : ""}`);
};

async function decodePng(png: Buffer, max = 4) {
  return readBarcodes(new Uint8Array(png), { tryHarder: true, maxNumberOfSymbols: max, textMode: "HRI" });
}
async function svgToPng(svg: string, width = 900) {
  return sharp(Buffer.from(svg), { density: 300 }).resize(width).flatten({ background: "#ffffff" }).png().toBuffer();
}

// ---------- check digits ----------
console.log("\n# Check digits");
check("EAN-13 4006381333931 valid", isValidGs1("4006381333931"));
check("EAN-13 check digit of 590123412345 = 7", gs1CheckDigit("590123412345") === 7);
check("UPC-A 036000291452 valid", isValidGs1("036000291452"));
check("EAN-8 96385074 valid", isValidGs1("96385074"));
check("ITF-14 15400141288763 valid", isValidGs1("15400141288763"));
check("UPC-E 01234565 expands to 012345000065", upceToUpca("01234565") === "012345000065");
check("UPC-E 04252614 expands to 042100005264", upceToUpca("04252614") === "042100005264");
const isbn10 = validateBarcode("isbn", "0-306-40615-2");
check("ISBN-10 0306406152 → 9780306406157", isbn10.ok && isbn10.value === "9780306406157");
const issn = validateBarcode("issn", "0317-8471");
check("ISSN 0317-8471 → EAN 9770317847001", issn.ok && issn.value === "9770317847001", JSON.stringify(issn));
const autoCheck = validateBarcode("ean13", "590123412345");
check("EAN-13 12 digits gets check digit appended", autoCheck.ok && autoCheck.value === "5901234123457");

// ---------- invalid input ----------
console.log("\n# Invalid input is rejected");
const invalid: [string, string][] = [
  ["ean13", "5901234123458"], ["ean13", "59012341234"], ["ean13", "59012341234A7"], ["ean8", "96385075"], ["upca", "036000291453"],
  ["upce", "21234565"], ["upce", "01234566"], ["isbn", "9780306406158"], ["isbn", "1234567890123"], ["issn", "0317-8472"],
  ["code39", "lowercase"], ["code39", "BAD#CHAR"], ["code93", "a"], ["code128", "emoji 😀"], ["itf", "12345"], ["itf14", "15400141288764"],
  ["codabar", "A12X4B"], ["gs1-128", "0109521234543213"], ["gs1-128", "(01)09521234543214"], ["gs1-128", "(17)261332"],
  ["gs1datamatrix", "(00)123"], ["std2of5", "12AB"], ["msi", "12.5"], ["datamatrix", ""], ["microqr", "X".repeat(40)],
];
for (const [f, v] of invalid) {
  const r = validateBarcode(f, v);
  check(`${f} rejects ${JSON.stringify(v)}`, !r.ok, "accepted");
}
// bwip-level GS1 rules surface as readable errors
for (const f of ["gs1-128", "gs1datamatrix", "gs1qr"]) {
  const r = validateBarcode(f, "(10)LOT7");
  check(`${f}: batch without GTIN rejected (GS1 requisite-AI rule)`, !r.ok && /GTIN/.test(r.error), JSON.stringify(r));
}
let bwipError = "";
try { renderBarcodeSvg("gs1datamatrix", "(10)LOT7"); } catch (e) { bwipError = (e as Error).message; }
check("encoder errors are surfaced as readable messages", /requisite AIs/i.test(bwipError) && !bwipError.startsWith("bwipp"), bwipError);

// ---------- round trip every format ----------
console.log("\n# Generate → render → decode (zxing-wasm)");
const SAMPLES: Record<string, { input: string; expect: (v: string) => string[] }> = {
  ean13: { input: "8901234567890", expect: (v) => [v] },
  ean8: { input: "9638507", expect: (v) => [v] },
  upca: { input: "036000291452", expect: (v) => [v, "0" + v] },
  upce: { input: "0123456", expect: (v) => [v, upceToUpca(v), "0" + upceToUpca(v)] },
  isbn: { input: "978-0-306-40615-7", expect: (v) => [v] },
  issn: { input: "0317-8471", expect: (v) => [v] },
  code128: { input: "SKU-1042/blu m", expect: (v) => [v] },
  "gs1-128": { input: "(01)08901234567890(17)271231(10)LOT42", expect: (v) => [v] },
  code39: { input: "PART-7781 X", expect: (v) => [v] },
  code93: { input: "ABC-123", expect: (v) => [v] },
  codabar: { input: "40156", expect: (v) => [v] },
  itf: { input: "12345678", expect: (v) => [v] },
  itf14: { input: "1540014128876", expect: (v) => [v] },
  std2of5: { input: "12345678", expect: () => [] },
  msi: { input: "1234567", expect: () => [] },
  datamatrix: { input: "PN:7781 SN:000123", expect: (v) => [v] },
  gs1datamatrix: { input: "(01)08901234567890(17)271231(10)LOT42(21)SN001", expect: (v) => [v] },
  pdf417: { input: "INV-2026-0042|Qty 12", expect: (v) => [v] },
  aztec: { input: "TICKET-8812-A", expect: (v) => [v] },
  microqr: { input: "A1B2C3", expect: (v) => [v] },
  gs1qr: { input: "(01)08901234567890(10)LOT42", expect: (v) => [v] },
};
for (const f of BARCODE_FORMATS) {
  const s = SAMPLES[f.id];
  if (!s) { check(`${f.id} has a test sample`, false); continue; }
  const v = validateBarcode(f.id, s.input);
  if (!v.ok) { check(`${f.id} validates sample`, false, v.error); continue; }
  const svg = renderBarcodeSvg(f.id, v.value, { background: "ffffff" });
  check(`${f.label}: SVG export`, svg.startsWith("<svg") && svg.includes("</svg>"));
  const png = await bwipjs.toBuffer({ bcid: f.bcid, text: v.value, scale: 3, ...(f.dims === "1d" ? { height: 14, includetext: true } : {}), paddingwidth: 12, paddingheight: 12, backgroundcolor: "FFFFFF", ...f.bwip } as any);
  check(`${f.label}: PNG export`, png.subarray(1, 4).toString() === "PNG" && png.length > 200);
  if (!f.scannable) {
    const r = await decodePng(png);
    check(`${f.label}: generate-only (scanner correctly reports nothing)`, r.length === 0, r.map((x) => x.text).join());
    continue;
  }
  // decode both the bwip PNG and our SVG rasterised by sharp
  for (const [src, buf] of [["png", png], ["svg", await svgToPng(svg)]] as const) {
    const r = await decodePng(buf);
    const got = r[0]?.text ?? "(nothing)";
    const want = s.expect(v.value);
    check(`${f.label}: decodes from ${src} → ${got}`, want.includes(got), `expected ${want.join(" or ")}`);
  }
}

// ---------- labels ----------
console.log("\n# Labels stay scannable");
for (const layout of ["barcode", "product", "shelf", "compact"] as const) {
  const svg = renderBarcodeSvg("ean13", "8901234567890", { background: "ffffff" });
  const label = renderLabelSvg(svg, layout, { w: 62, h: 29 }, { name: "Masala Chai 250g", variant: "Pack of 2", price: "₹ 199.00", sku: "SKU-CHAI-250", extra: "BATCH L42" });
  const r = await decodePng(await svgToPng(label, 1400));
  check(`label "${layout}" decodes`, r[0]?.text === "8901234567890", r.map((x) => x.text).join());
}

// ---------- multiple codes in one image ----------
console.log("\n# Multiple codes in one image");
const tiles = await Promise.all([
  bwipjs.toBuffer({ bcid: "code128", text: "MULTI-A", scale: 3, height: 12, paddingwidth: 20, paddingheight: 20, backgroundcolor: "FFFFFF" } as any),
  bwipjs.toBuffer({ bcid: "ean13", text: "8901234567890", scale: 3, height: 12, includetext: true, paddingwidth: 20, paddingheight: 20, backgroundcolor: "FFFFFF" } as any),
  bwipjs.toBuffer({ bcid: "datamatrix", text: "MULTI-DM", scale: 6, paddingwidth: 20, paddingheight: 20, backgroundcolor: "FFFFFF" } as any),
]);
const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
const W = Math.max(...metas.map((m) => m.width!)) + 40;
let top = 20;
const composite = tiles.map((t, i) => { const o = { input: t, top, left: 20 }; top += metas[i].height! + 60; return o; });
const sheet = await sharp({ create: { width: W, height: top, channels: 3, background: "#ffffff" } }).composite(composite).png().toBuffer();
const multi = await decodePng(sheet, 10);
const texts = multi.map((r) => r.text).sort();
check("3 different codes found in one image", ["8901234567890", "MULTI-A", "MULTI-DM"].every((t) => texts.includes(t)), texts.join(", "));

// Strip pass used for uploaded images: ZXing's multi-symbol search misses the
// PDF417 in this sheet; overlapping full-resolution strips find it.
console.log("\n# Multi-code image: full pass + strip pass");
{
  const opt = (bcid: string, text: string) => ({ bcid, text, scale: bcid === "qrcode" ? 6 : 4, paddingwidth: 20, paddingheight: 20, backgroundcolor: "FFFFFF", ...(["qrcode", "pdf417"].includes(bcid) ? {} : { height: 18, includetext: true }) });
  const t = await Promise.all([["ean13", "8901234567890"], ["code39", "UPLOAD-39"], ["qrcode", "upi://pay?pa=shop@okaxis&pn=Test&cu=INR"], ["pdf417", "PDF417-UPLOAD"]].map(([b, x]) => bwipjs.toBuffer(opt(b, x) as any)));
  const ms = await Promise.all(t.map((x) => sharp(x).metadata()));
  const w = Math.max(...ms.map((m) => m.width!)) + 80;
  let y = 40;
  const parts = t.map((x, i) => { const o = { input: x, top: y, left: 40 }; y += ms[i].height! + 80; return o; });
  const img = await sharp({ create: { width: w, height: y, channels: 3, background: "#ffffff" } }).composite(parts).png().toBuffer();
  const toLoc = (rs: Awaited<ReturnType<typeof decodePng>>) => rs.filter((r) => r.isValid).map((r) => ({ text: r.text, format: r.format, corners: [r.position.topLeft, r.position.topRight, r.position.bottomRight, r.position.bottomLeft] }));
  const full = toLoc(await decodePng(img, 32));
  check("full-image pass alone misses the PDF417 (known ZXing limitation this guards against)", !full.some((r) => r.format === "PDF417"), full.map((r) => r.text).join());
  let merged = full;
  for (const r of stripRects(w, y)) {
    const strip = await sharp(img).extract({ left: r.x, top: r.y, width: r.w, height: r.h }).png().toBuffer();
    merged = mergeResults(merged, toLoc(await decodePng(strip, 16)).map((h) => offsetResult(h, r.x, r.y)));
  }
  const texts = merged.map((r) => r.text).sort();
  const expected = ["8901234567890", "PDF417-UPLOAD", "UPLOAD-39", "upi://pay?pa=shop@okaxis&pn=Test&cu=INR"].sort();
  check("full + strip passes find all 4 codes, no extras", JSON.stringify(texts) === JSON.stringify(expected), texts.join(" | "));
  const fake = { text: "0660103032102", format: "EAN13", corners: full.find((r) => r.format === "EAN13")!.corners };
  check("an extra-pass result overlapping an existing read is rejected (misread guard)", mergeResults(full, [fake]).length === full.length);
}

// ---------- existing QR / UPI via new scanner ----------
console.log("\n# Existing QR renderer → zxing scanner");
const upi = buildUpiUri({ pa: "shop@okaxis", pn: "Sharma Store", am: "250", tn: "Order 12" });
for (const [name, payload, design] of [
  ["UPI QR (rounded + logo frame)", upi, { ...DEFAULT_DESIGN, moduleStyle: "rounded", frame: "banner" }],
  ["URL QR (dots)", "https://example.com/menu?t=4", { ...DEFAULT_DESIGN, moduleStyle: "dots" }],
] as const) {
  const r = await decodePng(await svgToPng(renderQr(payload, design as any).svg, 700));
  check(`${name} decodes with zxing`, r[0]?.text === payload, r[0]?.text);
}

// ---------- lookup normalisation & internal numbers ----------
console.log("\n# Lookup normalisation & internal numbers");
check("UPC-A and its EAN-13 form share a lookup key", lookupKey("upca", "036000291452") === lookupKey("ean13", "0036000291452"));
check("Scanned EAN-13 '0036000291452' matches UPC-A key", scanLookupKeys("0036000291452", "EAN13").includes(lookupKey("upca", "036000291452")));
check("GS1-128 (01) GTIN matches EAN-13 key", lookupKey("gs1-128", "(01)08901234567890(10)LOT") === lookupKey("ean13", "8901234567890"));
check("UPC-E key = expanded UPC-A key", lookupKey("upce", "01234565") === lookupKey("upca", "012345000065"));
check("parseGs1 reads AIs", JSON.stringify(parseGs1("(01)08901234567890(17)271231(10)LOT42")?.map((p) => p.ai)) === '["01","17","10"]');
check("buildGs1String from product fields", buildGs1String("8901234567890", "L1", "2027-12-31") === "(01)08901234567890(17)271231(10)L1");
let allRcn = true;
for (let i = 0; i < 200; i++) {
  for (const f of ["ean13", "ean8", "upca"]) {
    const n = generateInternalNumber(f);
    const v = validateBarcode(f, n);
    if (!v.ok || !isRestrictedCirculation(f, n)) { allRcn = false; console.log("   bad internal", f, n); }
  }
}
check("Internal EAN/UPC numbers are valid and in restricted-circulation ranges (never real GTIN ranges)", allRcn);

// ---------- built-in examples shown in the UI are valid ----------
console.log("\n# UI examples & quick-start samples");
const uiSamples: [string, string][] = [
  ...BARCODE_FORMATS.map((f) => [f.id, f.example] as [string, string]),
  ["ean13", "890123456789"], ["code128", "SKU-1042-BLU-M"], ["isbn", "978-0-306-40615-7"], ["itf14", "1890123456789"],
  ["gs1-128", "(01)18901234567897(17)271231(10)LOT42"], ["aztec", "TICKET-2026-0042"],
];
for (const [f, input] of uiSamples) {
  const r = validateBarcode(f, input);
  let rendered = false;
  try { if (r.ok) rendered = renderBarcodeSvg(f, r.value).startsWith("<svg"); } catch {}
  check(`${f} example ${JSON.stringify(input)} is valid and renders`, r.ok && rendered, r.ok ? "render failed" : r.error);
}

// ---------- PDF ----------
console.log("\n# PDF export");
const labelSvg = renderLabelSvg(renderBarcodeSvg("code128", "SKU-PDF-1", { background: "ffffff" }), "product", { w: 50, h: 25 }, { name: "PDF test", price: "₹ 10.00", sku: "SKU-PDF-1" });
const labelPng = await svgToPng(labelSvg, 600);
const pdf = new jsPDF({ unit: "mm", format: "a4" });
for (let i = 0; i < 6; i++) pdf.addImage(`data:image/png;base64,${labelPng.toString("base64")}`, "PNG", 10 + (i % 3) * 60, 10 + Math.floor(i / 3) * 30, 50, 25);
const pdfBuf = Buffer.from(pdf.output("arraybuffer"));
check("PDF label sheet is a valid PDF", pdfBuf.subarray(0, 5).toString() === "%PDF-" && pdfBuf.length > 2000);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
