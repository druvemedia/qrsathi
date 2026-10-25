/** Client-safe site settings shape (no server imports). */
import type { Branding } from "./branding";

export interface SiteSettings {
  /** Published brand name (alias of branding.brandName, kept for existing components). */
  siteName: string;
  /** Short description (alias of branding.shortDescription). */
  tagline: string;
  /** Legacy colour preset key; colours now come from branding.primaryColor. */
  brand: string;
  announcement: string;
  allowSignups: boolean;
  supportEmail: string;
  companyName: string;
  branding: Branding;
}

/** Legacy HSL presets (pre-branding installs stored one of these keys). */
export const BRAND_COLORS: Record<string, { label: string; hsl: string; accent: string }> = {
  indigo: { label: "Indigo", hsl: "243 75% 59%", accent: "262 83% 58%" },
  violet: { label: "Violet", hsl: "262 83% 58%", accent: "199 89% 48%" },
  saffron: { label: "Saffron", hsl: "24 95% 50%", accent: "142 71% 35%" },
  emerald: { label: "Emerald", hsl: "160 84% 32%", accent: "199 89% 48%" },
  blue: { label: "Blue", hsl: "221 83% 53%", accent: "262 83% 58%" },
  rose: { label: "Rose", hsl: "346 77% 50%", accent: "24 95% 53%" },
};
