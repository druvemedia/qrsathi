export type PlanId = "free" | "pro" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  priceInr: number; // per month
  tagline: string;
  dynamicLimit: number;
  hostedLimit: number;
  bulkRows: number;
  savedLimit: number;
  customAlias: boolean;
  expiry: boolean;
  analyticsDays: number;
  uploadMb: number;
  productLimit: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free", name: "Free", priceInr: 0, tagline: "For individuals getting started",
    dynamicLimit: 5, hostedLimit: 3, bulkRows: 100, savedLimit: 50, customAlias: false, expiry: false, analyticsDays: 30, uploadMb: 10, productLimit: 100,
    features: ["Unlimited static QR codes", "All 26 QR types + UPI", "PNG, JPG, SVG & PDF downloads", "5 dynamic QR codes", "3 hosted pages", "Bulk up to 100 rows", "100 products with barcodes & inventory", "30-day analytics"],
  },
  pro: {
    id: "pro", name: "Pro", priceInr: 299, tagline: "For creators and small shops",
    dynamicLimit: 100, hostedLimit: 50, bulkRows: 1000, savedLimit: 1000, customAlias: true, expiry: true, analyticsDays: 365, uploadMb: 25, productLimit: 5000,
    features: ["Everything in Free", "100 dynamic QR codes", "50 hosted pages", "Custom short-link aliases", "Expiry dates", "Bulk up to 1,000 rows", "5,000 products & inventory", "1-year analytics + CSV export"],
  },
  business: {
    id: "business", name: "Business", priceInr: 999, tagline: "For teams, chains and agencies",
    dynamicLimit: 2000, hostedLimit: 500, bulkRows: 5000, savedLimit: 20000, customAlias: true, expiry: true, analyticsDays: 730, uploadMb: 50, productLimit: 50000,
    features: ["Everything in Pro", "2,000 dynamic QR codes", "500 hosted pages", "Bulk up to 5,000 rows", "50,000 products & inventory", "2-year analytics", "Priority support"],
  },
};

export const GUEST_BULK_ROWS = 25;

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) || "free"] ?? PLANS.free;
}
