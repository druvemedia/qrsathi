import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { SecurityView } from "../security-view";

export const metadata: Metadata = { title: "Security events" };

export default async function SecurityEventsPage() {
  await requirePageAdmin("/admin/security/events");
  return (
    <>
      <PageHeader icon={<ShieldAlert />} title="Security events" description="Sign-in activity, failed sign-ins and 2FA codes, re-authentication and rejected requests." />
      <SecurityView mode="events" initialCategory="failures" />
    </>
  );
}
