import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { SecurityView } from "../security-view";

export const metadata: Metadata = { title: "Administrators" };

export default async function AdministratorsPage() {
  await requirePageAdmin("/admin/security/admins");
  return (
    <>
      <PageHeader icon={<UserCog />} title="Administrator accounts" description="Who can sign in to this console, their role and two-factor status. Roles are changed from Users by a super administrator, or with the server CLI." />
      <SecurityView mode="admins" initialCategory="admin" />
    </>
  );
}
