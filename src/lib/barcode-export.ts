"use client";
/** Download & print helpers for barcodes and product labels. */
import { buildPdf, downloadBlob, svgBlob, svgToPngBlob } from "./qr-export";

const DPI = 300;
export const mmToPx = (mm: number, dpi = DPI) => Math.round((mm / 25.4) * dpi);

export async function downloadSvgAs(svg: string, kind: "png" | "svg", filename: string, widthPx: number) {
  if (kind === "svg") return downloadBlob(svgBlob(svg), `${filename}.svg`);
  downloadBlob(await svgToPngBlob(svg, widthPx), `${filename}.png`);
}

/** One label per page (thermal/label printers) or tiled on A4 (sticker sheets). */
export async function labelsPdf(svgs: { svg: string; label?: string }[], size: { w: number; h: number }, sheet: "labels" | "a4") {
  if (sheet === "labels") return buildPdf(svgs, { paper: "fit", sizeMm: size.w, layout: "single", marginMm: 0 });
  return buildPdf(svgs, { paper: "a4", sizeMm: size.w, layout: "grid", marginMm: 8 });
}

/**
 * Prints labels through a hidden iframe at their physical size (mm), so the
 * browser print dialog can send them straight to a label or A4 printer.
 */
export function printLabels(svgs: string[], size: { w: number; h: number }, sheet: "labels" | "a4") {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const pageCss = sheet === "labels"
    ? `@page{size:${size.w}mm ${size.h}mm;margin:0}.l{width:${size.w}mm;height:${size.h}mm;page-break-after:always;overflow:hidden}`
    : `@page{size:A4;margin:8mm}.wrap{display:flex;flex-wrap:wrap;gap:3mm}.l{width:${size.w}mm;height:${size.h}mm;outline:0.2mm dashed #ccc;break-inside:avoid}`;
  const body = svgs.map((s) => `<div class="l">${s.replace(/width="[\d.]+mm" height="[\d.]+mm"/, 'width="100%" height="100%"')}</div>`).join("");
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><title>Labels</title><style>html,body{margin:0;padding:0}${pageCss}svg{display:block}</style></head><body>${sheet === "a4" ? `<div class="wrap">${body}</div>` : body}</body></html>`);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 2000);
  }, 300);
}
