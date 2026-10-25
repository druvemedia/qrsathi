import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { UsersView } from "./users-view";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const { user } = await requirePageAdmin("/admin/users");
  return (
    <>
      <PageHeader icon={<Users />} title="Users" description="Search accounts, manage status and plans, sign users out and send password-reset links. Passwords, tokens and MFA secrets are never shown." />
      <UsersView actor={{ id: user.id, role: user.role }} />
    </>
  );
}
