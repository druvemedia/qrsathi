/**
 * Upload validation for branding images, without native dependencies:
 * magic bytes, dimensions (parsed from the file headers) and, for SVG, a strict
 * reject-list of anything that could execute script or load external content.
 * SVGs are additionally served with a sandboxing CSP and only used via <img>.
 */
export type ImageType = "png" | "jpg" | "webp" | "svg";
export interface ImageInfo { type: ImageType; width: number; height: number; mime: string }

const MIME: Record<ImageType, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

function png(b: Buffer) {
  if (b.length < 24 || b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || b.subarray(12, 16).toString() !== "IHDR") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function jpg(b: Buffer) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function webp(b: Buffer) {
  if (b.length < 30 || b.subarray(0, 4).toString() !== "RIFF" || b.subarray(8, 12).toString() !== "WEBP") return null;
  const chunk = b.subarray(12, 16).toString();
  if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") { const v = b.readUInt32LE(21); return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
  if (chunk === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  return null;
}

/** Anything matching these makes an SVG unacceptable (script, events, external refs, entities, embedded HTML). */
const SVG_FORBIDDEN = [
  /<script/i, /\son[a-z]+\s*=/i, /javascript\s*:/i, /<foreignObject/i, /<!ENTITY/i, /<!DOCTYPE/i, /<iframe/i, /<embed/i, /<object/i,
  /<\?xml-stylesheet/i, /@import/i, /<image[\s>]/i, /<use[\s>]/i, /<a[\s>]/i, /<animate/i, /<set[\s>]/i, /<handler/i, /<listener/i,
  // href / url() may only point inside the document (#id).
  /href\s*=\s*["']?\s*[^#"'\s]/i, /url\s*\(\s*["']?\s*[^#"'\s)]/i, /data\s*:/i, /<html/i, /<body/i, /<meta/i, /<link/i, /<style[^>]*>[^<]*(expression|behavior)/i,
];

function svg(b: Buffer) {
  const text = b.toString("utf8");
  if (b.includes(0) || !/^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return { error: "Not a valid SVG file." };
  const bad = SVG_FORBIDDEN.find((re) => re.test(text));
  if (bad) return { error: "This SVG contains scripts, event handlers, embedded content or external references. Export a plain SVG (shapes and paths only) or use PNG/WebP." };
  const tag = /<svg[^>]*>/i.exec(text)![0];
  const num = (a: string) => { const m = new RegExp(`\\s${a}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, "i").exec(tag); return m ? Number(m[1]) : NaN; };
  let width = num("width"), height = num("height");
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(tag);
  if ((!width || !height) && vb) { width = Number(vb[1]); height = Number(vb[2]); }
  if (!width || !height) return { error: "The SVG needs a viewBox or width/height." };
  return { width: Math.round(width), height: Math.round(height) };
}

export function inspectImage(buf: Buffer, declaredExt: string): ImageInfo | { error: string } {
  const ext = declaredExt === "jpeg" ? "jpg" : declaredExt;
  if (!["png", "jpg", "webp", "svg"].includes(ext)) return { error: "Use a PNG, JPEG, WebP or SVG image." };
  const type = ext as ImageType;
  const dims = type === "png" ? png(buf) : type === "jpg" ? jpg(buf) : type === "webp" ? webp(buf) : svg(buf);
  if (!dims) return { error: `The file isn't a valid ${type.toUpperCase()} image.` };
  if ("error" in dims) return { error: dims.error as string };
  if (!dims.width || !dims.height) return { error: "Couldn't read the image dimensions." };
  return { type, width: dims.width, height: dims.height, mime: MIME[type] };
}

export const ASSET_RULES = {
  logo: { maxBytes: 1024 * 1024, min: 16, max: 4096, aspect: [0.2, 10], hint: "PNG, WebP or SVG with a transparent background, at least 160 px tall works best." },
  logoDark: { maxBytes: 1024 * 1024, min: 16, max: 4096, aspect: [0.2, 10], hint: "A light version of your logo for dark backgrounds." },
  favicon: { maxBytes: 256 * 1024, min: 16, max: 1024, aspect: [0.9, 1.1], hint: "Square, 512 × 512 px recommended (PNG or SVG)." },
  ogImage: { maxBytes: 2 * 1024 * 1024, min: 200, max: 4096, aspect: [1.2, 2.5], hint: "1200 × 630 px recommended (PNG, JPEG or WebP)." },
} as const;

export function checkAssetRules(kind: keyof typeof ASSET_RULES, size: number, info: ImageInfo): string | null {
  const r = ASSET_RULES[kind];
  if (size > r.maxBytes) return `The file is larger than ${Math.round(r.maxBytes / 1024)} KB.`;
  if (info.width < r.min || info.height < r.min) return `The image must be at least ${r.min} × ${r.min} px.`;
  if (info.width > r.max || info.height > r.max) return `The image must be at most ${r.max} × ${r.max} px.`;
  const ratio = info.width / info.height;
  if (ratio < r.aspect[0] || ratio > r.aspect[1]) return kind === "favicon" ? "Favicons must be square." : kind === "ogImage" ? "Social images should be landscape (about 1.91 : 1)." : "That aspect ratio is too extreme for a logo.";
  if (kind === "ogImage" && info.type === "svg") return "Social networks don't display SVG previews. Use PNG, JPEG or WebP.";
  return null;
}
