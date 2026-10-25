import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { AdminPanel } from "./admin-panel";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminPage() {
  await requirePageAdmin();
  return (
    <>
      <PageHeader icon={<Shield className="h-6 w-6" />} title="Admin dashboard" description="Users, redirects, abuse reports, billing, logs and site settings." />
      <AdminPanel />
    </>
  );
}
