import type { Metadata } from "next";
import { Flag } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "Abuse reports" };

export default async function AdminReportsPage() {
  await requirePageAdmin("/admin/reports");
  return (
    <>
      <PageHeader icon={<Flag />} title="Abuse reports" description="Reports submitted by the public about QR codes. Disable the code, suspend the owner, or dismiss." />
      <ReportsView />
    </>
  );
}
