import { redirect } from "next/navigation";
import { getAdmin, getUser } from "./session";
import { isSuperAdmin } from "./roles";

/** Server-component guard: redirects guests to the login page. */
export async function requirePageUser(next: string) {
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/**
 * Admin-console page guard. Requires an admin-console session (a workspace
 * session never grants access). Super administrators without MFA are sent
 * to enrolment before any other console page.
 */
export async function requirePageAdmin(path: string, opts: { allowWithoutMfa?: boolean } = {}) {
  const a = await getAdmin();
  if (!a) redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  if (!opts.allowWithoutMfa && isSuperAdmin(a.user.role) && !a.user.mfaEnabledAt) redirect("/admin/mfa");
  return a;
}
