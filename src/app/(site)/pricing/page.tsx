import type { Metadata } from "next";
import { publishedPlans } from "@/lib/plan-store";
import { checkoutCreds } from "@/lib/payment-config";
import { PricingView } from "./pricing-view";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Static QR codes and UPI payment QR are free. Paid plans add dynamic QR codes, hosted pages, larger inventories, bulk generation and longer analytics.",
};
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [plans, creds] = await Promise.all([publishedPlans(), checkoutCreds()]);
  return <PricingView plans={plans} checkoutAvailable={!!creds} />;
}
