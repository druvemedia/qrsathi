import type { Metadata } from "next";
import { Palette } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { BrandingEditor } from "../branding/branding-editor";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearancePage() {
  await requirePageAdmin("/admin/settings/appearance");
  return (
    <>
      <PageHeader icon={<Palette />} title="Appearance" description="Brand colours, default theme, header style and logo variants for light and dark backgrounds. Shares the same draft as Website branding." />
      <BrandingEditor section="appearance" />
    </>
  );
}
