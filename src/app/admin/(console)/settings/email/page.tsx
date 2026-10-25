import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { EmailView } from "./email-view";

export const metadata: Metadata = { title: "Email" };

export default async function EmailSettingsPage() {
  await requirePageAdmin("/admin/settings/email");
  return (
    <>
      <PageHeader icon={<Mail />} title="Email configuration" description="Outgoing mail for password resets and notifications. SMTP credentials are set with environment variables on the server and are never shown here." />
      <EmailView />
    </>
  );
}
