/**
 * Plan catalogue types, defaults and validation. Isomorphic (no server imports):
 * the admin pricing editor and pricing cards use the same schema and helpers.
 *
 * Plans are stored in the PricingPlan table and managed at /admin/settings/pricing.
 * The defaults below seed an empty database and are the fallback if a user's plan
 * record is missing. Prices are integer minor units (paise) — never floats.
 */
import { z } from "zod";

export const EXPORT_FORMATS = ["png", "jpg", "svg", "pdf", "zip"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"] as const;
export type Interval = "month" | "year";

export interface PlanLimits {
  /** Saved QR codes (static + dynamic + hosted). */
  savedQr: number;
  dynamic: number;
  hosted: number;
  /** Barcodes stored on products. */
  barcodes: number;
  products: number;
  /** Rows per bulk batch / import. */
  bulkRows: number;
  /** Largest single upload. */
  uploadMb: number;
  /** Total stored uploads. */
  storageMb: number;
  /** Days of scan analytics; 0 = analytics not included. */
  analyticsDays: number;
  analyticsExport: boolean;
  customAlias: boolean;
  expiry: boolean;
  exports: ExportFormat[];
  prioritySupport: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  currency: string;
  /** Minor units per month; 0 = not offered monthly. */
  monthlyPrice: number;
  /** Minor units per year; 0 = not offered yearly. */
  annualPrice: number;
  features: string[];
  limits: PlanLimits;
  featured: boolean;
  status: "draft" | "published" | "archived";
  sortOrder: number;
}

export const FREE_PLAN_ID = "free";

const FREE_LIMITS: PlanLimits = {
  savedQr: 50, dynamic: 5, hosted: 3, barcodes: 200, products: 100, bulkRows: 100, uploadMb: 10, storageMb: 100,
  analyticsDays: 30, analyticsExport: true, customAlias: false, expiry: false, exports: ["png", "jpg", "svg", "pdf", "zip"], prioritySupport: false,
};

export const DEFAULT_PLANS: Plan[] = [
  {
    id: "free", name: "Free", description: "For individuals getting started", currency: "INR", monthlyPrice: 0, annualPrice: 0,
    features: ["Unlimited static QR codes", "All QR types + UPI", "PNG, JPG, SVG & PDF downloads", "5 dynamic QR codes", "3 hosted pages", "100 products with barcodes & inventory", "30-day analytics"],
    limits: FREE_LIMITS, featured: false, status: "published", sortOrder: 0,
  },
  {
    id: "pro", name: "Pro", description: "For creators and small shops", currency: "INR", monthlyPrice: 29900, annualPrice: 299000,
    features: ["Everything in Free", "100 dynamic QR codes", "50 hosted pages", "Custom short-link aliases", "Expiry dates", "Bulk up to 1,000 rows", "5,000 products & inventory", "1-year analytics"],
    limits: { ...FREE_LIMITS, savedQr: 1000, dynamic: 100, hosted: 50, barcodes: 10000, products: 5000, bulkRows: 1000, uploadMb: 25, storageMb: 2000, analyticsDays: 365, analyticsExport: true, customAlias: true, expiry: true },
    featured: true, status: "published", sortOrder: 1,
  },
  {
    id: "business", name: "Business", description: "For teams, chains and agencies", currency: "INR", monthlyPrice: 99900, annualPrice: 999000,
    features: ["Everything in Pro", "2,000 dynamic QR codes", "500 hosted pages", "Bulk up to 5,000 rows", "50,000 products & inventory", "2-year analytics", "Priority support"],
    limits: { ...FREE_LIMITS, savedQr: 20000, dynamic: 2000, hosted: 500, barcodes: 100000, products: 50000, bulkRows: 5000, uploadMb: 50, storageMb: 20000, analyticsDays: 730, analyticsExport: true, customAlias: true, expiry: true, prioritySupport: true },
    featured: false, status: "published", sortOrder: 2,
  },
];

export const GUEST_BULK_ROWS = 25;

export const defaultPlan = (id?: string | null) => DEFAULT_PLANS.find((p) => p.id === id) ?? DEFAULT_PLANS[0];
export const isPaid = (p: Pick<Plan, "monthlyPrice" | "annualPrice">) => p.monthlyPrice > 0 || p.annualPrice > 0;
export const intervalsOf = (p: Pick<Plan, "monthlyPrice" | "annualPrice">): Interval[] =>
  [...(p.monthlyPrice > 0 ? ["month" as const] : []), ...(p.annualPrice > 0 ? ["year" as const] : [])];
export const priceFor = (p: Pick<Plan, "monthlyPrice" | "annualPrice">, i: Interval) => (i === "month" ? p.monthlyPrice : p.annualPrice);

/** Yearly saving vs 12 × monthly, in whole percent (null if not comparable). */
export function annualDiscount(p: Pick<Plan, "monthlyPrice" | "annualPrice">) {
  if (!p.monthlyPrice || !p.annualPrice) return null;
  const full = p.monthlyPrice * 12;
  return full > p.annualPrice ? Math.round(((full - p.annualPrice) / full) * 100) : 0;
}

/** Formats minor units without floating-point arithmetic. */
export function formatMoney(minor: number, currency = "INR") {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(minor));
  const major = Math.floor(abs / 100);
  const cents = abs % 100;
  const symbol: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SGD: "S$" };
  const majorText = major.toLocaleString(currency === "INR" ? "en-IN" : "en-US");
  return `${sign}${symbol[currency] ?? currency + " "}${majorText}${cents ? "." + String(cents).padStart(2, "0") : ""}`;
}

/** Parses "299" / "299.50" into minor units exactly (string arithmetic, no floats). */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  const [maj, min = ""] = s.split(".");
  return Number(maj) * 100 + Number(min.padEnd(2, "0"));
}

// ---------- validation (admin editor + API) ----------

const count = (max: number) => z.number().int().min(0).max(max);
export const limitsSchema = z.object({
  savedQr: count(10_000_000), dynamic: count(10_000_000), hosted: count(10_000_000), barcodes: count(10_000_000), products: count(10_000_000),
  bulkRows: count(100_000), uploadMb: z.number().int().min(1).max(500), storageMb: z.number().int().min(1).max(1_000_000),
  analyticsDays: count(3650), analyticsExport: z.boolean(), customAlias: z.boolean(), expiry: z.boolean(),
  exports: z.array(z.enum(EXPORT_FORMATS)).max(EXPORT_FORMATS.length).refine((a) => new Set(a).size === a.length, "Duplicate export format"),
  prioritySupport: z.boolean(),
});

const price = z.number().int("Prices are stored in whole minor units").min(0, "Prices can't be negative").max(1_000_000_000);

export const planInputSchema = z.object({
  id: z.string().trim().regex(/^[a-z][a-z0-9-]{1,31}$/, "Use 2–32 lowercase letters, digits or dashes, starting with a letter"),
  name: z.string().trim().min(1, "Name is required").max(40),
  description: z.string().trim().max(200),
  currency: z.enum(CURRENCIES),
  monthlyPrice: price,
  annualPrice: price,
  features: z.array(z.string().trim().min(1).max(120)).max(20),
  limits: limitsSchema,
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
}).superRefine((p, ctx) => {
  if (p.id === FREE_PLAN_ID && (p.monthlyPrice || p.annualPrice)) ctx.addIssue({ code: "custom", path: ["monthlyPrice"], message: "The Free plan can't have a price" });
  if (p.monthlyPrice && p.monthlyPrice < 100) ctx.addIssue({ code: "custom", path: ["monthlyPrice"], message: "Minimum paid price is 1.00 (Razorpay minimum)" });
  if (p.annualPrice && p.annualPrice < 100) ctx.addIssue({ code: "custom", path: ["annualPrice"], message: "Minimum paid price is 1.00 (Razorpay minimum)" });
});
export type PlanInput = z.infer<typeof planInputSchema>;

/** Parses a stored PricingPlan row into a Plan, falling back to safe defaults. */
export function planFromRow(row: { id: string; name: string; description: string; currency: string; monthlyPrice: number; annualPrice: number; features: string; limits: string; featured: boolean; status: string; sortOrder: number }): Plan {
  const fallback = defaultPlan(row.id === FREE_PLAN_ID ? FREE_PLAN_ID : null).limits;
  let features: string[] = [];
  let limits: PlanLimits = fallback;
  try { const f = JSON.parse(row.features); if (Array.isArray(f)) features = f.filter((x) => typeof x === "string").slice(0, 20); } catch {}
  try { const l = limitsSchema.safeParse({ ...fallback, ...JSON.parse(row.limits) }); if (l.success) limits = l.data; } catch {}
  return {
    id: row.id, name: row.name, description: row.description, currency: row.currency, monthlyPrice: row.monthlyPrice, annualPrice: row.annualPrice,
    features, limits, featured: row.featured, status: (["draft", "published", "archived"].includes(row.status) ? row.status : "draft") as Plan["status"], sortOrder: row.sortOrder,
  };
}

/** Comparison rows generated from real entitlements (never from marketing copy). */
export const COMPARISON: { label: string; value: (l: PlanLimits) => string }[] = [
  { label: "Static QR codes & downloads", value: () => "Unlimited" },
  { label: "Saved QR codes", value: (l) => l.savedQr.toLocaleString("en-IN") },
  { label: "Dynamic QR codes", value: (l) => l.dynamic.toLocaleString("en-IN") },
  { label: "Hosted pages", value: (l) => l.hosted.toLocaleString("en-IN") },
  { label: "Products & inventory items", value: (l) => l.products.toLocaleString("en-IN") },
  { label: "Stored product barcodes", value: (l) => l.barcodes.toLocaleString("en-IN") },
  { label: "Rows per bulk batch", value: (l) => l.bulkRows.toLocaleString("en-IN") },
  { label: "Scan analytics history", value: (l) => (l.analyticsDays ? `${l.analyticsDays} days` : "—") },
  { label: "Analytics CSV export", value: (l) => (l.analyticsExport ? "Included" : "—") },
  { label: "Custom short-link alias", value: (l) => (l.customAlias ? "Included" : "—") },
  { label: "Expiry dates", value: (l) => (l.expiry ? "Included" : "—") },
  { label: "Largest upload / total storage", value: (l) => `${l.uploadMb} MB / ${l.storageMb >= 1000 ? `${l.storageMb / 1000} GB` : `${l.storageMb} MB`}` },
  { label: "Priority support", value: (l) => (l.prioritySupport ? "Included" : "—") },
];
