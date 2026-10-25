"use client";
/** Browser-only export helpers: rasterise SVG, build PDFs/ZIPs, self-test scans. */
import jsQR from "jsqr";

export type ExportFormat = "png" | "jpg" | "svg" | "pdf";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not render the image."));
    img.src = src;
  });
}

/** Draws an SVG string onto a canvas `width` px wide (height keeps aspect ratio). */
export async function svgToCanvas(svg: string, width: number, opts: { background?: string } = {}) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const ratio = (img.naturalHeight || img.height) / (img.naturalWidth || img.width) || 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width);
    canvas.height = Math.round(width * ratio);
    const ctx = canvas.getContext("2d")!;
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), type, quality),
  );
}

export async function svgToPngBlob(svg: string, width: number) {
  return canvasToBlob(await svgToCanvas(svg, width), "image/png");
}
export async function svgToJpgBlob(svg: string, width: number) {
  // JPG has no transparency – flatten onto white.
  return canvasToBlob(await svgToCanvas(svg, width, { background: "#ffffff" }), "image/jpeg", 0.95);
}
export function svgBlob(svg: string) {
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: "image/svg+xml" });
}

export type PaperSize = "a4" | "a5" | "a6" | "letter" | "fit";
const PAPER_MM: Record<Exclude<PaperSize, "fit">, [number, number]> = {
  a4: [210, 297],
  a5: [148, 210],
  a6: [105, 148],
  letter: [215.9, 279.4],
};

export interface PdfItem {
  svg: string;
  label?: string;
}

export interface PdfOptions {
  paper: PaperSize;
  sizeMm: number; // printed width of each QR
  layout: "single" | "grid";
  marginMm?: number;
  dpi?: number;
}

/** Builds a print-ready PDF. "grid" tiles every item (or repeats a single item) across pages. */
export async function buildPdf(items: PdfItem[], o: PdfOptions) {
  const { jsPDF } = await import("jspdf");
  const dpi = o.dpi ?? 300;
  const margin = o.marginMm ?? 10;
  const px = Math.min(4000, Math.round((o.sizeMm / 25.4) * dpi));

  // Rasterise first so we know each item's aspect ratio.
  const rendered = [];
  for (const it of items) {
    const canvas = await svgToCanvas(it.svg, px, { background: "#ffffff" });
    rendered.push({ data: canvas.toDataURL("image/png"), ratio: canvas.height / canvas.width, label: it.label });
  }
  const maxRatio = Math.max(...rendered.map((r) => r.ratio));
  const itemW = o.sizeMm;
  const labelH = rendered.some((r) => r.label) ? 6 : 0;
  const itemH = itemW * maxRatio + labelH;

  let pageW: number, pageH: number;
  if (o.paper === "fit") {
    pageW = itemW + margin * 2;
    pageH = itemH + margin * 2;
  } else [pageW, pageH] = PAPER_MM[o.paper];

  const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: pageW > pageH ? "landscape" : "portrait" });
  const gap = 6;

  if (o.layout === "single" || o.paper === "fit") {
    rendered.forEach((r, i) => {
      if (i > 0) pdf.addPage([pageW, pageH]);
      const w = Math.min(itemW, pageW - margin * 2);
      const h = w * r.ratio;
      const x = (pageW - w) / 2, y = Math.max(margin, (pageH - h - labelH) / 2);
      pdf.addImage(r.data, "PNG", x, y, w, h, undefined, "FAST");
      if (r.label) {
        pdf.setFontSize(10);
        pdf.text(r.label, pageW / 2, y + h + 5, { align: "center" });
      }
    });
  } else {
    const cols = Math.max(1, Math.floor((pageW - margin * 2 + gap) / (itemW + gap)));
    const rows = Math.max(1, Math.floor((pageH - margin * 2 + gap) / (itemH + gap)));
    const perPage = cols * rows;
    // A single item in grid mode fills one page with copies (e.g. table tents, stickers).
    const list = rendered.length === 1 ? Array(perPage).fill(rendered[0]) : rendered;
    const offsetX = (pageW - (cols * itemW + (cols - 1) * gap)) / 2;
    list.forEach((r, i) => {
      const k = i % perPage;
      if (i > 0 && k === 0) pdf.addPage([pageW, pageH]);
      const c = k % cols, row = Math.floor(k / cols);
      const x = offsetX + c * (itemW + gap);
      const y = margin + row * (itemH + gap);
      pdf.addImage(r.data, "PNG", x, y, itemW, itemW * r.ratio, undefined, "FAST");
      if (r.label) {
        pdf.setFontSize(8);
        pdf.text(r.label.slice(0, 40), x + itemW / 2, y + itemW * r.ratio + 4, { align: "center" });
      }
    });
  }
  return pdf.output("blob");
}

export async function exportSvg(svg: string, format: Exclude<ExportFormat, "pdf">, width: number) {
  if (format === "svg") return svgBlob(svg);
  if (format === "jpg") return svgToJpgBlob(svg, width);
  return svgToPngBlob(svg, width);
}

export interface ScanTestResult {
  ok: boolean;
  decoded: string | null;
}

/**
 * Rasterises the design and decodes it with jsQR at a few resolutions,
 * the same way a phone camera samples it. Confirms the image really scans
 * back to the intended payload.
 */
export async function scanTest(svg: string, expected: string): Promise<ScanTestResult> {
  let last: string | null = null;
  for (const px of [640, 480, 900]) {
    const canvas = await svgToCanvas(svg, px, { background: "#ffffff" });
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
    if (r) {
      last = r.data;
      if (r.data === expected) return { ok: true, decoded: r.data };
    }
  }
  return { ok: false, decoded: last };
}

export async function buildZip(files: { name: string; blob: Blob }[]) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const seen = new Map<string, number>();
  for (const f of files) {
    let name = f.name;
    const n = seen.get(name) || 0;
    if (n) name = name.replace(/(\.[^.]+)$/, `-${n + 1}$1`);
    seen.set(f.name, n + 1);
    zip.file(name, f.blob);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/** Downscales an uploaded logo to a compact PNG data URL. */
export async function fileToLogoDataUrl(file: File, max = 256): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.type)) throw new Error("Use a PNG, JPG, WEBP, GIF or SVG image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Logo must be under 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
    const w = Math.max(1, Math.round((img.width || max) * scale));
    const h = Math.max(1, Math.round((img.height || max) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
