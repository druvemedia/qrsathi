import type { Metadata } from "next";
import { Suspense } from "react";
import { CreditCard } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { CheckoutStatus } from "./checkout-status";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };

export default async function BillingStatusPage() {
  await requirePageUser("/dashboard/settings#billing");
  return (
    <>
      <PageHeader icon={<CreditCard />} title="Payment status" />
      <Suspense fallback={<Spinner />}><CheckoutStatus /></Suspense>
    </>
  );
}
