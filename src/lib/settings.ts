import { cache } from "react";
import { db } from "./db";
import { BRAND_COLORS, type SiteSettings } from "./brand";

export { BRAND_COLORS, type SiteSettings };


export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "QRSathi",
  tagline: "Smart QR codes & UPI payment QR for India",
  brand: "indigo",
  announcement: "",
  allowSignups: true,
  supportEmail: "support@example.com",
  companyName: "QRSathi",
};


export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const rows = await db.setting.findMany();
    const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      if (!(r.key in DEFAULT_SETTINGS)) continue;
      out[r.key] = typeof DEFAULT_SETTINGS[r.key as keyof SiteSettings] === "boolean" ? r.value === "true" : r.value;
    }
    return out as unknown as SiteSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function saveSettings(s: Partial<SiteSettings>) {
  for (const [key, value] of Object.entries(s)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    await db.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  }
}
