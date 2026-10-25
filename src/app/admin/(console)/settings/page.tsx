import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Site settings" };

export default async function AdminSettingsPage() {
  await requirePageAdmin("/admin/settings");
  return (
    <>
      <PageHeader icon={<Settings />} title="Site settings" description="Branding, sign-up policy and the site-wide announcement. Integrations are configured with environment variables (see System)." />
      <SettingsView />
    </>
  );
}
