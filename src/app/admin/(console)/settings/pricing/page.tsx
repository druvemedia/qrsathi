import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { PricingAdmin } from "./pricing-admin";

export const metadata: Metadata = { title: "Plans & pricing" };

export default async function PricingSettingsPage() {
  const { user } = await requirePageAdmin("/admin/settings/pricing");
  return (
    <>
      <PageHeader icon={<Tags />} title="Plans & pricing" description="Plans, prices, entitlements and the public pricing page. Limits are enforced on the server for every account on the plan." />
      <PricingAdmin canEdit={user.role === "super_admin"} />
    </>
  );
}
