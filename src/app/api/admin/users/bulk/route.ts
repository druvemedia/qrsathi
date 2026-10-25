import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin, revokeAllSessions } from "@/lib/session";
import { assertCanManage, assertNotLastSuperAdmin } from "@/lib/admin-users";
import { audit } from "@/lib/audit";

const schema = z.object({ ids: z.array(z.string().max(40)).min(1).max(100), action: z.enum(["suspend", "reactivate", "revoke_sessions"]) });

/** Bulk account actions; each account is checked and audited individually. */
export const POST = handle(async (req) => {
  const admin = await requireAdmin();
  const { ids, action } = await readJson(req, schema, 50_000);
  const users = await db.user.findMany({ where: { id: { in: ids } } });
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const u of users) {
    try {
      if (action === "revoke_sessions") await assertCanManage(admin, u, "sessions");
      else {
        await assertCanManage(admin, u, "status");
        await assertNotLastSuperAdmin(u, { status: action === "suspend" ? "suspended" : "active" });
      }
      if (action === "suspend") {
        await db.user.update({ where: { id: u.id }, data: { status: "suspended", sessionVersion: { increment: 1 } } });
        await revokeAllSessions(u.id);
      } else if (action === "reactivate") {
        await db.user.update({ where: { id: u.id }, data: { status: "active" } });
      } else {
        await db.user.update({ where: { id: u.id }, data: { sessionVersion: { increment: 1 } } });
        await revokeAllSessions(u.id);
      }
      await audit(`admin.user.${action === "suspend" ? "suspended" : action === "reactivate" ? "reactivated" : "sessions_revoked"}`, {
        actor: admin, targetType: "user", targetId: u.id, ip: clientIp(req), details: { bulk: true },
      });
      results.push({ id: u.id, ok: true });
    } catch (e) {
      results.push({ id: u.id, ok: false, error: e instanceof ApiError ? e.message : "Failed" });
    }
  }
  return json({ results, done: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
});
