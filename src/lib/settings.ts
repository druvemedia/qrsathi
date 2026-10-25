import { cache } from "react";
import { db } from "./db";
import { BRAND_COLORS, type SiteSettings } from "./brand";
import { BRAND_DEFAULTS, hslTripletToHex, sanitizeBranding, type Branding } from "./branding";

export { BRAND_COLORS, type SiteSettings };

/** General (non-branding) settings stored as individual Setting rows. */
const GENERAL_DEFAULTS = { announcement: "", allowSignups: true };
const GENERAL_KEYS = ["announcement", "allowSignups"] as const;
const LEGACY_KEYS = ["siteName", "tagline", "brand", "supportEmail", "companyName"];
export const BRANDING_PUBLISHED = "branding.published";
export const BRANDING_DRAFT = "branding.draft";

type Rows = Map<string, string>;

/** Defaults for installs that predate the branding editor: reuse their legacy settings. */
function legacyBase(rows: Rows): Branding {
  const b = { ...BRAND_DEFAULTS };
  const name = rows.get("siteName");
  if (name) { b.brandName = name.slice(0, 40); b.titleTemplate = `%s · ${name}`.slice(0, 70); }
  const tagline = rows.get("tagline");
  if (tagline) b.shortDescription = tagline.slice(0, 120);
  if (name && tagline) b.siteTitle = `${name} — ${tagline}`.slice(0, 70);
  if (rows.get("supportEmail")) b.supportEmail = rows.get("supportEmail")!;
  if (rows.get("companyName")) b.companyName = rows.get("companyName")!.slice(0, 100);
  const preset = BRAND_COLORS[rows.get("brand") || ""];
  if (preset) { b.primaryColor = hslTripletToHex(preset.hsl); b.accentColor = hslTripletToHex(preset.accent); }
  return sanitizeBranding(b, BRAND_DEFAULTS);
}

async function readRows(): Promise<Rows> {
  try {
    const rows = await db.setting.findMany({ where: { key: { in: [...GENERAL_KEYS, ...LEGACY_KEYS, BRANDING_PUBLISHED, BRANDING_DRAFT] } } });
    return new Map(rows.map((r) => [r.key, r.value]));
  } catch {
    return new Map();
  }
}

function parse(json: string | undefined) {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

export async function brandingState() {
  const rows = await readRows();
  const base = legacyBase(rows);
  const publishedRaw = parse(rows.get(BRANDING_PUBLISHED));
  const published = publishedRaw ? sanitizeBranding(publishedRaw, base) : base;
  const draftRaw = parse(rows.get(BRANDING_DRAFT));
  return { published, draft: draftRaw ? sanitizeBranding(draftRaw, published) : null, defaults: BRAND_DEFAULTS, rows };
}

/** Published branding + general settings. Memoised per request; safe defaults on any error. */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const { published: b, rows } = await brandingState();
  return {
    siteName: b.brandName,
    tagline: b.shortDescription,
    brand: rows.get("brand") || "indigo",
    announcement: rows.get("announcement") ?? GENERAL_DEFAULTS.announcement,
    allowSignups: rows.has("allowSignups") ? rows.get("allowSignups") === "true" : GENERAL_DEFAULTS.allowSignups,
    supportEmail: b.supportEmail,
    companyName: b.companyName,
    branding: b,
  };
});

export async function saveGeneralSettings(s: Partial<{ announcement: string; allowSignups: boolean }>) {
  for (const key of GENERAL_KEYS) {
    const value = s[key];
    if (value === undefined) continue;
    await db.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  }
}

export async function writeSetting(key: string, value: string | null) {
  if (value === null) await db.setting.deleteMany({ where: { key } });
  else await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
