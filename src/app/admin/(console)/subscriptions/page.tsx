import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { SubscriptionsView } from "./subscriptions-view";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function AdminSubscriptionsPage() {
  await requirePageAdmin("/admin/subscriptions");
  return (
    <>
      <PageHeader icon={<CreditCard />} title="Subscriptions" description="Plan distribution and accounts on paid plans. Change an account's plan from Users." />
      <SubscriptionsView />
    </>
  );
}
