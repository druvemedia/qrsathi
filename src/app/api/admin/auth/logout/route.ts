import { handle, json } from "@/lib/api";
import { destroySession, getAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";

export const POST = handle(async () => {
  const a = await getAdmin();
  await destroySession("admin");
  if (a) await audit("admin.auth.logout", { actor: { id: a.user.id, email: a.user.email } });
  return json({ ok: true });
});
