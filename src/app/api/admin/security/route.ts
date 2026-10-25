import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listParams, paged } from "@/lib/admin-query";

/** Audit log (security events + administrator actions) and a security summary. */
export const GET = handle(async (req) => {
  await requireAdmin();
  const { sp, skip, take, page, pageSize, q } = listParams(req, ["createdAt"] as const, "createdAt");
  const category = sp.get("category");
  const where: Prisma.AuditLogWhereInput = {
    ...(category === "admin" ? { action: { startsWith: "admin." } } : category === "auth" ? { action: { startsWith: "auth." } } : category === "failures" ? { OR: [{ action: { contains: "failed" } }, { action: { contains: "denied" } }, { action: { contains: "blocked" } }] } : {}),
    ...(q ? { OR: [{ action: { contains: q } }, { actorEmail: { contains: q } }, { targetId: { contains: q } }] } : {}),
  };
  const d1 = new Date(Date.now() - 86400000);
  const [total, items, failed24h, mfaFailed24h, admins, activeAdminSessions] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.auditLog.count({ where: { action: { in: ["auth.login_failed", "admin.auth.login_failed"] }, createdAt: { gte: d1 } } }),
    db.auditLog.count({ where: { action: "admin.auth.mfa_failed", createdAt: { gte: d1 } } }),
    db.user.findMany({ where: { role: { in: ["admin", "super_admin"] } }, select: { id: true, email: true, role: true, status: true, mfaEnabledAt: true, lastLoginAt: true } }),
    db.session.count({ where: { kind: "admin", expiresAt: { gt: new Date() } } }),
  ]);
  return json({
    ...paged(items, total, page, pageSize),
    summary: { failed24h, mfaFailed24h, activeAdminSessions, admins: admins.map(({ mfaEnabledAt, ...a }) => ({ ...a, mfaEnabled: !!mfaEnabledAt })) },
  });
});
