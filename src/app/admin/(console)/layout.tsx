import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { getAdmin } from "@/lib/session";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

/** Every console page also calls requirePageAdmin() itself; this is the outer gate. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const a = await getAdmin();
  if (!a) {
    const path = safeNextPath((await headers()).get("x-admin-path"), "/admin");
    redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  }
  const { email, name, role, mfaEnabledAt } = a.user;
  return <AdminShell admin={{ email, name, role, mfaEnabled: !!mfaEnabledAt }}>{children}</AdminShell>;
}
