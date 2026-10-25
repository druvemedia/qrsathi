import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "General settings" };

export default async function AdminSettingsPage() {
  await requirePageAdmin("/admin/settings");
  return (
    <>
      <PageHeader icon={<Settings />} title="General settings" description="Sign-up policy and the site-wide announcement." />
      <SettingsView />
    </>
  );
}
