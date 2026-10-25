import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { PaymentsConfig } from "./payments-config";

export const metadata: Metadata = { title: "Payment gateway" };

export default async function PaymentGatewayPage() {
  const { user } = await requirePageAdmin("/admin/settings/payments");
  return (
    <>
      <PageHeader icon={<Landmark />} title="Payment gateway" description="Razorpay credentials, test/live mode and checkout status. Saved secrets are never shown again — only whether they're configured." />
      <PaymentsConfig canEdit={user.role === "super_admin"} />
    </>
  );
}
