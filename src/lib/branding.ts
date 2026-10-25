/**
 * Website branding: types, defaults, validation and colour helpers. Isomorphic.
 * Text is always rendered as text (React/Next metadata escape it); validation
 * additionally rejects markup characters and control characters in single-line
 * identity fields. Colours are strict #rrggbb.
 */
import { z } from "zod";

export const ASSET_KINDS = ["logo", "logoDark", "favicon", "ogImage"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** Social profiles that can be linked from the site footer, with the hosts each link must use. */
export const SOCIAL_NETWORKS = [
  { id: "instagram", label: "Instagram", hosts: ["instagram.com"], placeholder: "https://instagram.com/yourbrand" },
  { id: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com"], placeholder: "https://facebook.com/yourbrand" },
  { id: "x", label: "X (Twitter)", hosts: ["x.com", "twitter.com"], placeholder: "https://x.com/yourbrand" },
  { id: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"], placeholder: "https://www.linkedin.com/company/yourbrand" },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"], placeholder: "https://www.youtube.com/@yourbrand" },
  { id: "whatsapp", label: "WhatsApp", hosts: ["wa.me", "whatsapp.com"], placeholder: "https://wa.me/919876543210" },
  { id: "telegram", label: "Telegram", hosts: ["t.me", "telegram.me"], placeholder: "https://t.me/yourbrand" },
  { id: "github", label: "GitHub", hosts: ["github.com"], placeholder: "https://github.com/yourorg" },
] as const;
export type SocialId = (typeof SOCIAL_NETWORKS)[number]["id"];

export interface Branding {
  brandName: string;
  siteTitle: string;
  titleTemplate: string;
  shortDescription: string;
  homeDescription: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  companyName: string;
  supportEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerText: string;
  primaryColor: string;
  accentColor: string;
  defaultTheme: "system" | "light" | "dark";
  headerDisplay: "logo-name" | "logo" | "name";
  logo: string | null;
  logoDark: string | null;
  favicon: string | null;
  ogImage: string | null;
  /** Public profile URLs; empty strings are hidden. Never pre-filled. */
  social: Record<SocialId, string>;
}

export const BRAND_DEFAULTS: Branding = {
  brandName: "QRSathi",
  siteTitle: "QRSathi — QR codes, barcodes & UPI payment QR",
  titleTemplate: "%s · QRSathi",
  shortDescription: "QR codes, barcodes and UPI payment QR for Indian businesses",
  homeDescription: "Create print-ready QR codes and barcodes, accept UPI with a QR you design, edit dynamic codes after printing, and keep products and stock in one place.",
  metaDescription: "QR code and barcode generator for India: UPI payment QR, dynamic QR codes with privacy-first analytics, bulk generation, a universal scanner and inventory.",
  ogTitle: "",
  ogDescription: "",
  companyName: "QRSathi",
  supportEmail: "",
  contactPhone: "",
  contactAddress: "",
  footerText: "© {year} {company}. All rights reserved.",
  primaryColor: "#3b3fd8",
  accentColor: "#0f766e",
  defaultTheme: "system",
  headerDisplay: "logo-name",
  logo: null,
  logoDark: null,
  favicon: null,
  ogImage: null,
  social: Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.id, ""])) as Record<SocialId, string>,
};

// No markup, no control characters, single line.
const line = (max: number, min = 0) =>
  z.string().trim().min(min).max(max).refine((v) => !/[<>\u0000-\u001f\u007f]/.test(v), "Use plain text (no < > or control characters)");
const para = (max: number) => z.string().trim().max(max).refine((v) => !/[<>\u0000-\u0008\u000b-\u001f\u007f]/.test(v), "Use plain text (no < or >)");
const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #3b3fd8").transform((v) => v.toLowerCase());
/** Empty, or an https URL on one of the network's own hosts. */
const socialUrl = (hosts: readonly string[]) =>
  z.string().trim().max(300).refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      const h = u.hostname.toLowerCase();
      return u.protocol === "https:" && !u.username && !u.password && hosts.some((x) => h === x || h.endsWith("." + x));
    } catch {
      return false;
    }
  }, `Use an https:// link on ${hosts[0]}`);
const socialSchema = z.object(Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.id, socialUrl(n.hosts).default("")])) as Record<SocialId, z.ZodDefault<z.ZodString>>);

const asset = z.string().regex(/^[a-f0-9]{32}\.(png|jpg|webp|svg)$/).nullable();

export const brandingSchema = z.object({
  brandName: line(40, 1),
  siteTitle: line(70, 1),
  titleTemplate: line(70, 2).refine((v) => v.includes("%s"), "Must contain %s where the page title goes"),
  shortDescription: line(120),
  homeDescription: para(400),
  metaDescription: line(170),
  ogTitle: line(70),
  ogDescription: line(200),
  companyName: line(100, 1),
  supportEmail: z.string().trim().max(200).refine((v) => !v || z.email().safeParse(v).success, "Enter a valid e-mail address"),
  contactPhone: z.string().trim().max(30).refine((v) => !v || /^[+\d][\d\s()-]{5,28}$/.test(v), "Enter a valid phone number"),
  contactAddress: para(300),
  footerText: line(200),
  primaryColor: hex,
  accentColor: hex,
  defaultTheme: z.enum(["system", "light", "dark"]),
  headerDisplay: z.enum(["logo-name", "logo", "name"]),
  logo: asset,
  logoDark: asset,
  favicon: asset,
  ogImage: asset,
  social: socialSchema.default(BRAND_DEFAULTS.social),
});

/** Parses stored JSON, keeping valid fields and falling back to defaults for anything invalid. */
export function sanitizeBranding(raw: unknown, base: Branding = BRAND_DEFAULTS): Branding {
  const out: Branding = { ...base };
  if (!raw || typeof raw !== "object") return out;
  const shape = brandingSchema.shape as Record<string, z.ZodTypeAny>;
  for (const k of Object.keys(shape) as (keyof Branding)[]) {
    const r = shape[k].safeParse((raw as Record<string, unknown>)[k]);
    if (r.success) (out as any)[k] = r.data;
  }
  return out;
}

/** Configured social links only, in display order. */
export function socialLinks(b: Pick<Branding, "social">) {
  return SOCIAL_NETWORKS.filter((n) => b.social?.[n.id]).map((n) => ({ id: n.id, label: n.label, url: b.social[n.id] }));
}

/** Field-level comparison that treats nested values (social links) by content. */
export const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const assetUrl = (name: string | null) => (name ? `/brand/${name}` : null);
export const footerLine = (b: Pick<Branding, "footerText" | "companyName">) =>
  b.footerText.replace(/\{year\}/g, String(new Date().getFullYear())).replace(/\{company\}/g, b.companyName);

// ---------- colour helpers ----------

export function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

/** "#3b3fd8" → "239 66% 54%" for the --brand CSS variable. */
export function hexToHslTriplet(h: string) {
  const [r, g, b] = hexToRgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let hue = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  return `${Math.round(hue)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hslTripletToHex(t: string) {
  const [h, s, l] = t.replace(/%/g, "").split(/\s+/).map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function luminance(h: string) {
  const [r, g, b] = hexToRgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Text colour for buttons on the brand colour: white unless that fails contrast. */
export const onColor = (h: string) => (contrastRatio(h, "#ffffff") >= 4.5 ? "#ffffff" : contrastRatio(h, "#ffffff") >= contrastRatio(h, "#09090b") ? "#ffffff" : "#09090b");

export function themeCss(b: Pick<Branding, "primaryColor" | "accentColor">) {
  return `:root{--brand:${hexToHslTriplet(b.primaryColor)};--brand-fg:${hexToHslTriplet(onColor(b.primaryColor))};--accent:${hexToHslTriplet(b.accentColor)}}`;
}
