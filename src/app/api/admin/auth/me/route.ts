import { handle, json } from "@/lib/api";
import { getAdmin, publicUser } from "@/lib/session";

export const GET = handle(async () => {
  const a = await getAdmin();
  return json({ admin: a ? { ...(await publicUser(a.user)), sessionMfa: a.session.mfa } : null });
});
