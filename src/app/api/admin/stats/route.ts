import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const GET = handle(async () => {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 86400000);
  const [users, newUsers, suspended, qrs, dynamic, hosted, scans, scans30, downloads, openReports, errors24h, byPlan, byType, paid] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.user.count({ where: { status: "suspended" } }),
    db.qrCode.count(),
    db.qrCode.count({ where: { isDynamic: true, isHosted: false } }),
    db.qrCode.count({ where: { isHosted: true } }),
    db.scan.count(),
    db.scan.count({ where: { createdAt: { gte: since } } }),
    db.download.count(),
    db.abuseReport.count({ where: { status: "open" } }),
    db.log.count({ where: { level: "error", createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    db.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.qrCode.groupBy({ by: ["type"], _count: { _all: true }, orderBy: { _count: { type: "desc" } }, take: 12 }),
    db.payment.aggregate({ where: { status: "paid" }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const recentQr = await db.qrCode.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
  const daily = new Map<string, number>();
  for (let i = 29; i >= 0; i--) daily.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), 0);
  for (const q of recentQr) {
    const k = q.createdAt.toISOString().slice(0, 10);
    if (daily.has(k)) daily.set(k, daily.get(k)! + 1);
  }
  return json({
    users, newUsers, suspended, qrs, dynamic, hosted, scans, scans30, downloads, openReports, errors24h,
    byPlan: byPlan.map((p) => ({ name: p.plan, value: p._count._all })),
    byType: byType.map((t) => ({ name: t.type, value: t._count._all })),
    revenuePaise: paid._sum.amount || 0,
    paidCount: paid._count._all,
    qrDaily: [...daily.entries()].map(([date, count]) => ({ date, count })),
  });
});
