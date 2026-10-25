import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { PaymentsView } from "./payments-view";

export const metadata: Metadata = { title: "Payments" };

export default async function AdminPaymentsPage() {
  await requirePageAdmin("/admin/payments");
  return (
    <>
      <PageHeader icon={<Receipt />} title="Payments" description="Checkout records. A payment is marked paid only after Razorpay's signed webhook confirms it." />
      <PaymentsView />
    </>
  );
}
