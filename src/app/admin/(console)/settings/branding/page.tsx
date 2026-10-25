import type { Metadata } from "next";
import { LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { BrandingEditor } from "./branding-editor";

export const metadata: Metadata = { title: "Website branding" };

export default async function BrandingPage() {
  await requirePageAdmin("/admin/settings/branding");
  return (
    <>
      <PageHeader icon={<LayoutTemplate />} title="Website branding" description="Name, titles, descriptions, contact details, favicon and social image. Changes are saved as a draft and go live when you publish." />
      <BrandingEditor section="identity" />
    </>
  );
}
