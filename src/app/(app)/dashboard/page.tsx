import type { Metadata } from "next";
import { LayoutDashboard, Plus } from "lucide-react";
import { LinkButton, PageHeader } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { Library } from "./library";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const user = await requirePageUser("/dashboard");
  return (
    <>
      <PageHeader icon={<LayoutDashboard className="h-6 w-6" />} title={`Hi ${user.name.split(" ")[0] || "there"} 👋`}
        description="Your saved QR codes, dynamic links and hosted pages."
        actions={<><LinkButton href="/upi" variant="outline">UPI QR</LinkButton><LinkButton href="/generator"><Plus className="h-4 w-4" /> New QR code</LinkButton></>} />
      <Library />
    </>
  );
}
