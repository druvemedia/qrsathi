"use client";
/**
 * Browser wrapper around zxing-wasm (ZXing-C++ compiled to WebAssembly).
 * The .wasm binary is served from /zxing/ (copied by scripts/copy-wasm.mjs),
 * never from a third-party CDN.
 */
import type { ReadResult, ReaderOptions } from "zxing-wasm/reader";
import { mergeResults, offsetResult, stripRects } from "./scan-merge";

type ZX = typeof import("zxing-wasm/reader");
let mod: Promise<ZX> | null = null;

export function loadZXing(): Promise<ZX> {
  mod ??= import("zxing-wasm/reader").then((m) => {
    m.prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path) },
    });
    return m;
  });
  return mod;
}

export type ScanFilter = "all" | "qr2d" | "retail" | "linear";
export const SCAN_FILTERS: { value: ScanFilter; label: string; formats: NonNullable<ReaderOptions["formats"]> }[] = [
  { value: "all", label: "All formats", formats: [] },
  { value: "qr2d", label: "QR & 2D", formats: ["QRCode", "MicroQRCode", "RMQRCode", "DataMatrix", "PDF417", "Aztec", "MaxiCode"] },
  { value: "retail", label: "Retail (EAN/UPC)", formats: ["EAN13", "EAN8", "UPCA", "UPCE"] },
  { value: "linear", label: "All 1D barcodes", formats: ["EAN13", "EAN8", "UPCA", "UPCE", "Code128", "Code39", "Code93", "Codabar", "ITF", "DataBar", "DataBarExp", "DataBarLtd"] },
];

export const FORMAT_LABELS: Record<string, string> = {
  QRCode: "QR Code", MicroQRCode: "Micro QR", RMQRCode: "rMQR", DataMatrix: "Data Matrix", PDF417: "PDF417", Aztec: "Aztec", MaxiCode: "MaxiCode",
  EAN13: "EAN-13", EAN8: "EAN-8", UPCA: "UPC-A", UPCE: "UPC-E", ISBN: "ISBN", Code128: "Code 128", Code39: "Code 39", Code93: "Code 93",
  Codabar: "Codabar", ITF: "ITF", ITF14: "ITF-14", DataBar: "GS1 DataBar", DataBarExp: "GS1 DataBar Expanded", DataBarLtd: "GS1 DataBar Limited",
};

export interface ScanHit {
  text: string;
  format: string; // zxing format id, e.g. "EAN13"
  formatLabel: string;
  contentType: string; // Text | Binary | GS1 | …
  symbologyIdentifier: string;
  corners?: { x: number; y: number }[];
}

function toHit(r: ReadResult): ScanHit {
  const p = r.position;
  return {
    text: r.text,
    format: r.format,
    formatLabel: FORMAT_LABELS[r.format] || r.format,
    contentType: r.contentType,
    symbologyIdentifier: r.symbologyIdentifier,
    corners: p ? [p.topLeft, p.topRight, p.bottomRight, p.bottomLeft] : undefined,
  };
}

async function readOnce(input: Blob | ImageData, filter: ScanFilter, opts: { maxSymbols?: number; thorough?: boolean }) {
  const zx = await loadZXing();
  const formats = SCAN_FILTERS.find((f) => f.value === filter)?.formats ?? [];
  const results = await zx.readBarcodes(input, {
    formats,
    tryHarder: true,
    tryRotate: opts.thorough ?? true,
    tryInvert: opts.thorough ?? true,
    tryDownscale: true,
    maxNumberOfSymbols: opts.maxSymbols ?? 8,
    textMode: "HRI",
  });
  const seen = new Set<string>();
  return results.filter((r) => r.isValid && r.text && !seen.has(r.format + r.text) && seen.add(r.format + r.text)).map(toHit);
}

/** Decodes all codes in a camera frame. GS1 data is returned in human-readable "(01)…" form. */
export async function scanImage(input: Blob | ImageData, filter: ScanFilter = "all", opts: { maxSymbols?: number; thorough?: boolean } = {}) {
  return readOnce(input, filter, opts);
}

/**
 * Decodes an uploaded image: a full-image pass, then (for larger images)
 * overlapping full-resolution strips that catch codes the multi-symbol search
 * missed. Strip results never override what the full pass found.
 */
export async function scanImageFile(file: Blob, filter: ScanFilter = "all") {
  let results = await readOnce(file, filter, { maxSymbols: 32, thorough: true });
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (Math.max(bitmap.width, bitmap.height) < 600) return results;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    for (const r of stripRects(bitmap.width, bitmap.height)) {
      canvas.width = r.w;
      canvas.height = r.h;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, r.w, r.h);
      ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      const hits = await readOnce(ctx.getImageData(0, 0, r.w, r.h), filter, { maxSymbols: 16, thorough: false });
      results = mergeResults(results, hits.map((h) => offsetResult(h, r.x, r.y)));
    }
    return results;
  } catch (e) {
    console.warn("[scanner] strip pass failed", e);
    return results;
  } finally {
    bitmap?.close();
  }
}
