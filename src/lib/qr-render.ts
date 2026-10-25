/**
 * Pure SVG QR renderer. Uses the `qrcode` package only for encoding (module
 * matrix) and draws everything else itself, so output is identical in the
 * browser and on the server.
 */
import QRCode from "qrcode";
import { escapeXml } from "./utils";

export type ModuleStyle = "square" | "rounded" | "dots" | "diamond" | "fluid" | "bars";
export type EyeOuter = "square" | "rounded" | "circle" | "leaf";
export type EyeInner = "square" | "rounded" | "circle" | "leaf";
export type FrameStyle = "none" | "banner" | "banner-top" | "outline" | "bubble" | "badge";
export type PatternStyle = "none" | "dots" | "grid" | "diagonal" | "waves";
export type Ecc = "L" | "M" | "Q" | "H";

export interface QrDesign {
  fg: string;
  bg: string;
  transparent: boolean;
  gradient: { enabled: boolean; type: "linear" | "radial"; from: string; to: string; rotation: number };
  moduleStyle: ModuleStyle;
  eyeOuter: EyeOuter;
  eyeInner: EyeInner;
  eyeColor: string; // "" = same as modules
  logo: string | null; // data URL
  logoSize: number; // fraction of QR width, 0.1 – 0.3
  logoPadding: boolean;
  frame: FrameStyle;
  frameColor: string;
  frameText: string;
  frameTextColor: string;
  textAbove: string;
  textBelow: string;
  textColor: string;
  canvasBg: string;
  pattern: PatternStyle;
  patternColor: string;
  ecc: Ecc;
  margin: number; // quiet zone, in modules
}

export const DEFAULT_DESIGN: QrDesign = {
  fg: "#111827",
  bg: "#ffffff",
  transparent: false,
  gradient: { enabled: false, type: "linear", from: "#4f46e5", to: "#db2777", rotation: 45 },
  moduleStyle: "square",
  eyeOuter: "square",
  eyeInner: "square",
  eyeColor: "",
  logo: null,
  logoSize: 0.22,
  logoPadding: true,
  frame: "none",
  frameColor: "#4f46e5",
  frameText: "SCAN ME",
  frameTextColor: "#ffffff",
  textAbove: "",
  textBelow: "",
  textColor: "#111827",
  canvasBg: "#ffffff",
  pattern: "none",
  patternColor: "#4f46e5",
  ecc: "M",
  margin: 4,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v) ? v : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const text = (v: unknown, max = 60) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Merges a (possibly untrusted, e.g. loaded from the DB) partial design onto
 * the defaults, whitelisting every value so nothing can inject markup.
 */
export function mergeDesign(partial?: Partial<QrDesign> | null): QrDesign {
  const p = (partial || {}) as Record<string, any>;
  const D = DEFAULT_DESIGN;
  const g = (p.gradient || {}) as Record<string, any>;
  return {
    fg: color(p.fg, D.fg),
    bg: color(p.bg, D.bg),
    transparent: p.transparent === true,
    gradient: {
      enabled: g.enabled === true,
      type: pick(g.type, ["linear", "radial"] as const, "linear"),
      from: color(g.from, D.gradient.from),
      to: color(g.to, D.gradient.to),
      rotation: num(g.rotation, 0, 360, D.gradient.rotation),
    },
    moduleStyle: pick(p.moduleStyle, ["square", "rounded", "dots", "diamond", "fluid", "bars"] as const, D.moduleStyle),
    eyeOuter: pick(p.eyeOuter, ["square", "rounded", "circle", "leaf"] as const, D.eyeOuter),
    eyeInner: pick(p.eyeInner, ["square", "rounded", "circle", "leaf"] as const, D.eyeInner),
    eyeColor: p.eyeColor === "" ? "" : color(p.eyeColor, ""),
    logo: typeof p.logo === "string" && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(p.logo) ? p.logo : null,
    logoSize: num(p.logoSize, 0.1, 0.3, D.logoSize),
    logoPadding: p.logoPadding !== false,
    frame: pick(p.frame, ["none", "banner", "banner-top", "outline", "bubble", "badge"] as const, D.frame),
    frameColor: color(p.frameColor, D.frameColor),
    frameText: p.frameText === undefined ? D.frameText : text(p.frameText, 40),
    frameTextColor: color(p.frameTextColor, D.frameTextColor),
    textAbove: text(p.textAbove),
    textBelow: text(p.textBelow),
    textColor: color(p.textColor, D.textColor),
    canvasBg: color(p.canvasBg, D.canvasBg),
    pattern: pick(p.pattern, ["none", "dots", "grid", "diagonal", "waves"] as const, D.pattern),
    patternColor: color(p.patternColor, D.patternColor),
    ecc: pick(p.ecc, ["L", "M", "Q", "H"] as const, D.ecc),
    margin: Math.round(num(p.margin, 0, 10, D.margin)),
  };
}

export interface RenderResult {
  svg: string; // complete standalone document
  body: string; // defs + shapes without the <svg> wrapper (for embedding)
  width: number;
  height: number;
  moduleCount: number;
  version: number;
  ecc: Ecc;
}

const FONT = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const U = 10; // px per module in the SVG coordinate system
const ECC_ORDER: Ecc[] = ["L", "M", "Q", "H"];

/** Path for a rectangle with independent corner radii. */
function rr(x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number) {
  const f = (n: number) => +n.toFixed(2);
  return (
    `M${f(x + tl)},${f(y)}H${f(x + w - tr)}` +
    (tr ? `A${f(tr)},${f(tr)} 0 0 1 ${f(x + w)},${f(y + tr)}` : "") +
    `V${f(y + h - br)}` +
    (br ? `A${f(br)},${f(br)} 0 0 1 ${f(x + w - br)},${f(y + h)}` : "") +
    `H${f(x + bl)}` +
    (bl ? `A${f(bl)},${f(bl)} 0 0 1 ${f(x)},${f(y + h - bl)}` : "") +
    `V${f(y + tl)}` +
    (tl ? `A${f(tl)},${f(tl)} 0 0 1 ${f(x + tl)},${f(y)}` : "") +
    "Z"
  );
}
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
const diamond = (cx: number, cy: number, r: number) => `M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z`;

function eyeShape(kind: EyeOuter | EyeInner, x: number, y: number, size: number, corner: "tl" | "tr" | "bl", inner: boolean) {
  const r = size / 2;
  switch (kind) {
    case "circle":
      return circle(x + r, y + r, r);
    case "rounded": {
      const k = size * (inner ? 0.3 : 0.32);
      return rr(x, y, size, size, k, k, k, k);
    }
    case "leaf": {
      const k = size * 0.42;
      // round the outer corner and its diagonal opposite
      if (corner === "tl") return rr(x, y, size, size, k, 0, k, 0);
      if (corner === "tr") return rr(x, y, size, size, 0, k, 0, k);
      return rr(x, y, size, size, 0, k, 0, k);
    }
    default:
      return `M${x},${y}h${size}v${size}h${-size}Z`;
  }
}

function textWidthFit(text: string, fs: number, maxW: number) {
  // Rough average glyph width for bold sans: 0.62em
  const est = text.length * fs * 0.62;
  return est > maxW ? (maxW / (text.length * 0.62)) : fs;
}

export function effectiveEcc(design: QrDesign): Ecc {
  if (design.logo && ECC_ORDER.indexOf(design.ecc) < 3) return "H";
  return design.ecc;
}

export function renderQr(payload: string, designIn: Partial<QrDesign> | QrDesign, opts: { idPrefix?: string } = {}): RenderResult {
  const d = mergeDesign(designIn);
  const p = (opts.idPrefix || "q") + "-";
  const ecc = effectiveEcc(d);
  if (!payload) throw new Error("Nothing to encode yet.");
  let qr;
  try {
    qr = QRCode.create(payload, { errorCorrectionLevel: ecc });
  } catch {
    throw new Error("Content is too long for a QR code. Shorten it or use a dynamic QR / hosted page.");
  }
  const n = qr.modules.size;
  const m = Math.max(0, Math.min(10, Math.round(d.margin)));
  const plate = (n + 2 * m) * U;

  const isFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  // Logo knock-out region, in module units
  let logoBox: { x: number; y: number; s: number } | null = null;
  if (d.logo) {
    const size = Math.max(0.08, Math.min(0.32, d.logoSize)) * n;
    const start = (n - size) / 2;
    logoBox = { x: start, y: start, s: size };
  }
  const pad = d.logoPadding ? 0.6 : 0;
  const excavated = (r: number, c: number) =>
    !!logoBox &&
    c + 1 > logoBox.x - pad && c < logoBox.x + logoBox.s + pad &&
    r + 1 > logoBox.y - pad && r < logoBox.y + logoBox.s + pad;

  const dark = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < n && c < n && !!qr.modules.get(r, c) && !isFinder(r, c) && !excavated(r, c);

  // ----- modules -----
  let path = "";
  const ox = m * U, oy = m * U;
  if (d.moduleStyle === "square") {
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (dark(r, c)) {
          let len = 1;
          while (dark(r, c + len)) len++;
          path += `M${ox + c * U},${oy + r * U}h${len * U}v${U}h${-len * U}Z`;
          c += len;
        } else c++;
      }
    }
  } else if (d.moduleStyle === "bars") {
    const reserved = (r: number, c: number) => !!(qr.modules as any).isReserved?.(r, c);
    const bar = (r: number, c: number) => dark(r, c) && !reserved(r, c);
    for (let c = 0; c < n; c++) {
      let r = 0;
      while (r < n) {
        if (dark(r, c) && reserved(r, c)) {
          path += `M${ox + c * U},${oy + r * U}h${U}v${U}h${-U}Z`;
          r++;
        } else if (bar(r, c)) {
          let len = 1;
          while (bar(r + len, c)) len++;
          const w = U * 0.86, k = w / 2;
          path += rr(ox + c * U + (U - w) / 2, oy + r * U + U * 0.07, w, len * U - U * 0.14, k, k, k, k);
          r += len;
        } else r++;
      }
    }
  } else {
    // Function patterns (timing, alignment, format info) stay solid squares in
    // every style: scanners locate the grid with them, and gapped shapes there
    // are the main cause of failed reads with decorative styles.
    const reserved = (r: number, c: number) => !!(qr.modules as any).isReserved?.(r, c);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!dark(r, c)) continue;
        const x = ox + c * U, y = oy + r * U;
        if (d.moduleStyle !== "fluid" && reserved(r, c)) {
          path += `M${x},${y}h${U}v${U}h${-U}Z`;
          continue;
        }
        switch (d.moduleStyle) {
          case "dots":
            path += circle(x + U / 2, y + U / 2, U * 0.44);
            break;
          case "diamond":
            path += diamond(x + U / 2, y + U / 2, U * 0.56);
            break;
          case "rounded": {
            const k = U * 0.32;
            path += rr(x + 0.4, y + 0.4, U - 0.8, U - 0.8, k, k, k, k);
            break;
          }
          case "fluid": {
            const up = dark(r - 1, c), dn = dark(r + 1, c), lf = dark(r, c - 1), rt = dark(r, c + 1);
            const k = U / 2;
            path += rr(x, y, U, U, !up && !lf ? k : 0, !up && !rt ? k : 0, !dn && !rt ? k : 0, !dn && !lf ? k : 0);
            break;
          }
        }
      }
    }
  }

  // ----- finder eyes -----
  const eyes: { r: number; c: number; corner: "tl" | "tr" | "bl" }[] = [
    { r: 0, c: 0, corner: "tl" },
    { r: 0, c: n - 7, corner: "tr" },
    { r: n - 7, c: 0, corner: "bl" },
  ];
  let eyePath = "";
  for (const e of eyes) {
    const x = ox + e.c * U, y = oy + e.r * U;
    eyePath += eyeShape(d.eyeOuter, x, y, 7 * U, e.corner, false);
    eyePath += eyeShape(d.eyeOuter, x + U, y + U, 5 * U, e.corner, false);
    eyePath += eyeShape(d.eyeInner, x + 2 * U, y + 2 * U, 3 * U, e.corner, true);
  }

  // ----- paints -----
  const defs: string[] = [];
  let fill = d.fg;
  if (d.gradient.enabled) {
    const id = `${p}grad`;
    if (d.gradient.type === "radial") {
      defs.push(
        `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${plate / 2}" cy="${plate / 2}" r="${plate * 0.7}"><stop offset="0" stop-color="${d.gradient.from}"/><stop offset="1" stop-color="${d.gradient.to}"/></radialGradient>`,
      );
    } else {
      const a = (d.gradient.rotation * Math.PI) / 180;
      const cx = plate / 2, cy = plate / 2, h = plate / 2;
      const dx = Math.cos(a) * h, dy = Math.sin(a) * h;
      defs.push(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${(cx - dx).toFixed(1)}" y1="${(cy - dy).toFixed(1)}" x2="${(cx + dx).toFixed(1)}" y2="${(cy + dy).toFixed(1)}"><stop offset="0" stop-color="${d.gradient.from}"/><stop offset="1" stop-color="${d.gradient.to}"/></linearGradient>`,
      );
    }
    fill = `url(#${id})`;
  }
  const eyeFill = d.eyeColor || fill;

  // ----- QR plate group (origin 0,0, size plate) -----
  const plateRadius = Math.min(2 * U, m * U * 0.8);
  let qrGroup = "";
  if (!d.transparent) qrGroup += `<rect width="${plate}" height="${plate}" rx="${d.frame === "none" && !hasOuter(d) ? 0 : plateRadius}" fill="${d.bg}"/>`;
  qrGroup += `<path d="${path}" fill="${fill}"/>`;
  qrGroup += `<path d="${eyePath}" fill="${eyeFill}" fill-rule="evenodd"/>`;
  if (d.logo && logoBox) {
    const lx = ox + logoBox.x * U, ly = oy + logoBox.y * U, ls = logoBox.s * U;
    if (d.logoPadding) {
      const padPx = pad * U;
      qrGroup += `<rect x="${(lx - padPx).toFixed(1)}" y="${(ly - padPx).toFixed(1)}" width="${(ls + 2 * padPx).toFixed(1)}" height="${(ls + 2 * padPx).toFixed(1)}" rx="${(ls * 0.18).toFixed(1)}" fill="${d.transparent ? "#ffffff" : d.bg}"/>`;
    }
    qrGroup += `<image href="${escapeXml(d.logo)}" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" width="${ls.toFixed(1)}" height="${ls.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // ----- outer layout -----
  if (!hasOuter(d)) {
    const body = (defs.length ? `<defs>${defs.join("")}</defs>` : "") + qrGroup;
    return {
      svg: wrap(body, plate, plate),
      body,
      width: plate,
      height: plate,
      moduleCount: n,
      version: qr.version,
      ecc,
    };
  }

  const P = plate;
  const framed = d.frame !== "none";
  const padX = framed ? P * 0.07 : P * 0.05;
  const W = P + padX * 2;
  const capFs = P * 0.085;
  const txtFs = P * 0.065;
  const bandH = P * 0.17;
  const gap = P * 0.04;
  const radius = P * 0.06;

  let y = padX;
  const parts: string[] = [];
  const texts: string[] = [];
  const textEl = (t: string, cy: number, fs: number, color: string) => {
    const size = textWidthFit(t, fs, W * 0.88);
    return `<text x="${(W / 2).toFixed(1)}" y="${cy.toFixed(1)}" font-family="${FONT}" font-size="${size.toFixed(1)}" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="central">${escapeXml(t)}</text>`;
  };

  if (d.textAbove) {
    texts.push(textEl(d.textAbove, y + txtFs * 0.7, txtFs, d.textColor));
    y += txtFs * 1.4 + gap;
  }
  let topBand: number | null = null;
  if (d.frame === "banner-top") {
    topBand = y;
    y += bandH + gap;
  }
  const qrY = y;
  y += P;
  let bottomCaptionY: number | null = null;
  let bottomBand: number | null = null;
  if (d.frame === "banner") {
    bottomBand = y + gap;
    y += gap + bandH;
  } else if (d.frame === "outline" || d.frame === "badge") {
    bottomCaptionY = y + gap + capFs * 0.7;
    y += gap + capFs * 1.4;
  } else if (d.frame === "bubble") {
    bottomBand = y + gap * 1.6;
    y += gap * 1.6 + bandH;
  }
  if (d.textBelow) {
    y += gap;
    texts.push(textEl(d.textBelow, y + txtFs * 0.7, txtFs, d.textColor));
    y += txtFs * 1.4;
  }
  const H = y + padX;

  // card background
  const cardFill = d.frame === "badge" ? d.frameColor : d.transparent && !framed ? "none" : d.canvasBg;
  parts.push(`<rect width="${W.toFixed(1)}" height="${H.toFixed(1)}" rx="${radius.toFixed(1)}" fill="${cardFill}"/>`);
  if (d.pattern !== "none") {
    defs.push(patternDef(`${p}pat`, d.pattern, d.patternColor, P / 28));
    parts.push(`<rect width="${W.toFixed(1)}" height="${H.toFixed(1)}" rx="${radius.toFixed(1)}" fill="url(#${p}pat)"/>`);
  }
  if (d.frame === "banner" || d.frame === "banner-top" || d.frame === "outline") {
    const sw = P * 0.022;
    parts.push(
      `<rect x="${sw / 2}" y="${sw / 2}" width="${(W - sw).toFixed(1)}" height="${(H - sw).toFixed(1)}" rx="${(radius - sw / 2).toFixed(1)}" fill="none" stroke="${d.frameColor}" stroke-width="${sw.toFixed(1)}"/>`,
    );
  }
  const caption = d.frameText.trim();
  if (topBand !== null) {
    parts.push(`<path d="${rr(padX, topBand, P, bandH, radius * 0.6, radius * 0.6, radius * 0.6, radius * 0.6)}" fill="${d.frameColor}"/>`);
    if (caption) texts.push(textEl(caption, topBand + bandH / 2, capFs, d.frameTextColor));
  }
  if (bottomBand !== null) {
    const k = d.frame === "bubble" ? bandH / 2 : radius * 0.6;
    parts.push(`<path d="${rr(padX, bottomBand, P, bandH, k, k, k, k)}" fill="${d.frameColor}"/>`);
    if (d.frame === "bubble") {
      const tx = W / 2, ty = bottomBand;
      const t = gap * 1.2;
      parts.push(`<path d="M${tx - t},${ty + 1}L${tx},${ty - t * 0.9}L${tx + t},${ty + 1}Z" fill="${d.frameColor}"/>`);
    }
    if (caption) texts.push(textEl(caption, bottomBand + bandH / 2, capFs, d.frameTextColor));
  }
  if (bottomCaptionY !== null && caption) {
    texts.push(textEl(caption, bottomCaptionY, capFs, d.frame === "badge" ? d.frameTextColor : d.frameColor));
  }
  parts.push(`<g transform="translate(${padX.toFixed(1)},${qrY.toFixed(1)})">${qrGroup}</g>`);

  const body = (defs.length ? `<defs>${defs.join("")}</defs>` : "") + parts.join("") + texts.join("");
  return {
    svg: wrap(body, W, H),
    body,
    width: +W.toFixed(1),
    height: +H.toFixed(1),
    moduleCount: n,
    version: qr.version,
    ecc,
  };
}

function hasOuter(d: QrDesign) {
  return d.frame !== "none" || !!d.textAbove || !!d.textBelow || d.pattern !== "none";
}

function wrap(body: string, w: number, h: number) {
  const W = +w.toFixed(1), H = +h.toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
}

function patternDef(id: string, kind: PatternStyle, color: string, s: number) {
  const o = 'opacity="0.18"';
  switch (kind) {
    case "dots":
      return `<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.14}" fill="${color}" ${o}/></pattern>`;
    case "grid":
      return `<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><path d="M${s},0H0V${s}" fill="none" stroke="${color}" stroke-width="${s * 0.06}" ${o}/></pattern>`;
    case "diagonal":
      return `<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${s * 0.25}" height="${s}" fill="${color}" ${o}/></pattern>`;
    case "waves":
      return `<pattern id="${id}" width="${s * 2}" height="${s}" patternUnits="userSpaceOnUse"><path d="M0,${s / 2}Q${s / 2},0 ${s},${s / 2}T${s * 2},${s / 2}" fill="none" stroke="${color}" stroke-width="${s * 0.08}" ${o}/></pattern>`;
    default:
      return "";
  }
}

// ---------- scan-reliability checks ----------
function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function luminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface DesignWarning {
  level: "warn" | "info";
  message: string;
}

export function designWarnings(d: QrDesign): DesignWarning[] {
  const w: DesignWarning[] = [];
  const bg = d.transparent ? "#ffffff" : d.bg;
  const fgs = d.gradient.enabled ? [d.gradient.from, d.gradient.to] : [d.fg];
  if (d.eyeColor) fgs.push(d.eyeColor);
  const minContrast = Math.min(...fgs.map((c) => contrastRatio(c, bg)));
  if (minContrast < 3)
    w.push({ level: "warn", message: `Low contrast (${minContrast.toFixed(1)}:1). Use darker modules or a lighter background — aim for 4:1 or more.` });
  else if (minContrast < 4)
    w.push({ level: "info", message: `Contrast is ${minContrast.toFixed(1)}:1. Usually fine, but 4:1+ scans more reliably in poor light.` });
  if (fgs.some((c) => luminance(c) > luminance(bg)))
    w.push({ level: "warn", message: "Light modules on a dark background (inverted) are not supported by some scanner apps." });
  if (d.margin < 2) w.push({ level: "warn", message: "Quiet zone is very small. Keep a margin of at least 2 modules (4 recommended)." });
  if (d.transparent) w.push({ level: "info", message: "Transparent background: print it only on a light, plain surface." });
  if (d.logo && d.logoSize > 0.27) w.push({ level: "warn", message: "Large logos hide data. Keep the logo under ~25% of the QR width." });
  if (d.logo) w.push({ level: "info", message: "Error correction raised to H (30%) automatically because of the logo." });
  if (d.pattern !== "none" && d.transparent) w.push({ level: "warn", message: "Background patterns behind a transparent QR can break scanning." });
  if (d.moduleStyle === "diamond" || d.moduleStyle === "dots")
    w.push({ level: "info", message: "Dot and diamond modules look great but test-scan before printing." });
  return w;
}
