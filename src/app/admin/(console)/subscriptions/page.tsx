import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { SubscriptionsView } from "./subscriptions-view";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function AdminSubscriptionsPage() {
  const { user } = await requirePageAdmin("/admin/subscriptions");
  return (
    <>
      <PageHeader icon={<CreditCard />} title="Subscriptions" description="Razorpay subscriptions, their status and renewal dates. Admin-assigned plans are changed from Users." />
      <SubscriptionsView canManage={user.role === "super_admin"} />
    </>
  );
}
