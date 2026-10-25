import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { SecurityView } from "./security-view";

export const metadata: Metadata = { title: "Security & audit" };

export default async function AdminSecurityPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requirePageAdmin("/admin/security");
  const { category } = await searchParams;
  return (
    <>
      <PageHeader icon={<ShieldCheck />} title="Security & audit log" description="Sign-in activity, administrator accounts and every administrative action. Secrets and tokens are redacted before they're stored." />
      <SecurityView initialCategory={["admin", "auth", "failures"].includes(category || "") ? category! : ""} />
    </>
  );
}
