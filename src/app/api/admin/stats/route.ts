import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { fillDays } from "@/lib/admin-query";
import { razorpayConfigured } from "@/lib/config";

/** Platform KPIs for the admin overview — real database counts only. */
export const GET = handle(async () => {
  await requireAdmin();
  const d30 = new Date(Date.now() - 30 * 86400000);
  const d7 = new Date(Date.now() - 7 * 86400000);
  const d1 = new Date(Date.now() - 86400000);
  const [
    users, active, suspended, admins, new7, new30, qrs, dynamic, hosted, barcodes, products, scans, scans30, downloads,
    openReports, errors24h, failedLogins24h, adminLogins7d, byPlan, paid, signupDates, qrDates, recentAdmin, adminsNoMfa,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: "active" } }),
    db.user.count({ where: { status: "suspended" } }),
    db.user.count({ where: { role: { in: ["admin", "super_admin"] } } }),
    db.user.count({ where: { createdAt: { gte: d7 } } }),
    db.user.count({ where: { createdAt: { gte: d30 } } }),
    db.qrCode.count(),
    db.qrCode.count({ where: { isDynamic: true, isHosted: false } }),
    db.qrCode.count({ where: { isHosted: true } }),
    db.barcode.count(),
    db.product.count(),
    db.scan.count(),
    db.scan.count({ where: { createdAt: { gte: d30 } } }),
    db.download.count(),
    db.abuseReport.count({ where: { status: "open" } }),
    db.log.count({ where: { level: "error", createdAt: { gte: d1 } } }),
    db.auditLog.count({ where: { action: { in: ["auth.login_failed", "admin.auth.login_failed", "admin.auth.mfa_failed"] }, createdAt: { gte: d1 } } }),
    db.auditLog.count({ where: { action: "admin.auth.login", createdAt: { gte: d7 } } }),
    db.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.payment.aggregate({ where: { status: "paid" }, _sum: { amount: true }, _count: { _all: true } }),
    db.user.findMany({ where: { createdAt: { gte: d30 } }, select: { createdAt: true } }),
    db.qrCode.findMany({ where: { createdAt: { gte: d30 } }, select: { createdAt: true } }),
    db.auditLog.findMany({ where: { action: { startsWith: "admin." }, NOT: { action: { startsWith: "admin.auth.login_failed" } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.user.count({ where: { role: { in: ["admin", "super_admin"] }, mfaEnabledAt: null } }),
  ]);
  return json({
    users, active, suspended, admins, new7, new30, qrs, dynamic, hosted, barcodes, products, scans, scans30, downloads,
    openReports, errors24h, failedLogins24h, adminLogins7d, adminsNoMfa,
    byPlan: byPlan.map((p) => ({ name: p.plan, value: p._count._all })),
    billingConfigured: razorpayConfigured(),
    revenuePaise: paid._sum.amount || 0,
    paidCount: paid._count._all,
    signupsDaily: fillDays(30, signupDates.map((u) => u.createdAt)),
    qrDaily: fillDays(30, qrDates.map((q) => q.createdAt)),
    recentAdmin: recentAdmin.map((a) => ({ id: a.id, action: a.action, actorEmail: a.actorEmail, targetType: a.targetType, targetId: a.targetId, createdAt: a.createdAt })),
  });
});
