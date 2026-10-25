import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { createSession, getUserSession, requireUser, revokeAllSessions } from "@/lib/session";
import { audit } from "@/lib/audit";

/** Signs out every other device: other sessions are deleted and old tokens stop working. */
export const POST = handle(async () => {
  const user = await requireUser();
  const current = await getUserSession();
  await revokeAllSessions(user.id, { exceptSessionId: current?.session.id });
  const updated = await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await createSession(updated, { kind: "user" });
  await audit("auth.sessions_revoked", { actor: { id: user.id } });
  return json({ ok: true });
});
