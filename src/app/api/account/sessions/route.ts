import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { createSession, requireUser } from "@/lib/session";

/** Signs out every other device by rotating the session version. */
export const POST = handle(async () => {
  const user = await requireUser();
  const updated = await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await createSession(updated);
  return json({ ok: true });
});
