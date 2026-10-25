/** Client-safe branding constants (no server imports). */
export interface SiteSettings {
  siteName: string;
  tagline: string;
  brand: string; // key of BRAND_COLORS
  announcement: string;
  allowSignups: boolean;
  supportEmail: string;
  companyName: string;
}

/** HSL triplets used for the --brand / --accent CSS variables. */
export const BRAND_COLORS: Record<string, { label: string; hsl: string; accent: string }> = {
  indigo: { label: "Indigo", hsl: "243 75% 59%", accent: "330 81% 60%" },
  violet: { label: "Violet", hsl: "262 83% 58%", accent: "199 89% 48%" },
  saffron: { label: "Saffron", hsl: "24 95% 50%", accent: "142 71% 35%" },
  emerald: { label: "Emerald", hsl: "160 84% 32%", accent: "199 89% 48%" },
  blue: { label: "Blue", hsl: "221 83% 53%", accent: "262 83% 58%" },
  rose: { label: "Rose", hsl: "346 77% 50%", accent: "24 95% 53%" },
};
