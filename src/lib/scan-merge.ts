/**
 * Helpers for decoding uploaded images thoroughly. ZXing's multi-symbol search
 * can miss a code (notably PDF417) when several codes share one image; decoding
 * overlapping strips at full resolution finds it. Strip results are only
 * accepted where the full-image pass found nothing at that location, so an
 * extra pass can add codes but never replace (or contradict) a good read.
 */
export interface Pt { x: number; y: number }
export interface Located { text: string; format: string; corners?: Pt[] }
export interface Rect { x: number; y: number; w: number; h: number }

function box(c: Pt[]) {
  const xs = c.map((p) => p.x), ys = c.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
function overlaps(a: Pt[], b: Pt[]) {
  const A = box(a), B = box(b);
  const pad = Math.max(8, 0.1 * Math.min(A.x1 - A.x0, A.y1 - A.y0, B.x1 - B.x0, B.y1 - B.y0));
  return A.x0 - pad < B.x1 && B.x0 - pad < A.x1 && A.y0 - pad < B.y1 && B.y0 - pad < A.y1;
}

/** Adds results from an extra pass (corners already in full-image coordinates). */
export function mergeResults<T extends Located>(base: T[], extra: T[]): T[] {
  const out = [...base];
  for (const r of extra) {
    const dup = out.some((o) => o.format === r.format && o.text === r.text);
    const clash = r.corners && out.some((o) => o.corners && overlaps(o.corners, r.corners!));
    if (!dup && !clash) out.push(r);
  }
  return out;
}

/** Shifts a strip's result corners into full-image coordinates. */
export function offsetResult<T extends Located>(r: T, dx: number, dy: number): T {
  return { ...r, corners: r.corners?.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
}

/**
 * Overlapping strips (50 % overlap) along the long side at two sizes — ⅓ and ⅕
 * of the length — so every code appears whole in some strip without a large
 * neighbour cut in half beside it (a partial neighbour can hide e.g. a PDF417).
 */
export function stripRects(w: number, h: number): Rect[] {
  const vertical = h >= w;
  const len = vertical ? h : w, cross = vertical ? w : h;
  const out: Rect[] = [];
  for (const parts of [3, 5]) {
    const band = Math.max(250, Math.round(len / parts)), step = Math.round(band / 2);
    if (band >= len) continue;
    for (let s = 0; s < len; s += step) {
      const size = Math.min(band, len - s);
      out.push(vertical ? { x: 0, y: s, w: cross, h: size } : { x: s, y: 0, w: size, h: cross });
      if (s + size >= len) break;
    }
  }
  return out;
}

/** Linear (1D) symbologies need confirmation across camera frames; 2D codes carry strong error correction. */
export const MATRIX_FORMATS = new Set(["QRCode", "MicroQRCode", "RMQRCode", "DataMatrix", "PDF417", "Aztec", "MaxiCode"]);
