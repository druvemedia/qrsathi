import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { fillDays } from "@/lib/admin-query";

/** Platform-wide activity over time (aggregate counts only). */
export const GET = handle(async (req) => {
  await requireAdmin();
  const days = Math.max(7, Math.min(365, Number(new URL(req.url).searchParams.get("days")) || 30));
  const since = new Date(Date.now() - (days - 1) * 86400000);
  since.setUTCHours(0, 0, 0, 0);
  const w = { createdAt: { gte: since } };
  const [signups, qrs, scans, downloads, products, devices, types] = await Promise.all([
    db.user.findMany({ where: w, select: { createdAt: true } }),
    db.qrCode.findMany({ where: w, select: { createdAt: true } }),
    db.scan.findMany({ where: w, select: { createdAt: true } }),
    db.download.findMany({ where: w, select: { createdAt: true } }),
    db.product.findMany({ where: w, select: { createdAt: true } }),
    db.scan.groupBy({ by: ["device"], where: w, _count: { _all: true } }),
    db.qrCode.groupBy({ by: ["type"], where: w, _count: { _all: true }, orderBy: { _count: { type: "desc" } }, take: 10 }),
  ]);
  const series = (dates: { createdAt: Date }[]) => fillDays(days, dates.map((d) => d.createdAt));
  return json({
    days,
    totals: { signups: signups.length, qrs: qrs.length, scans: scans.length, downloads: downloads.length, products: products.length },
    signups: series(signups), qrs: series(qrs), scans: series(scans), downloads: series(downloads), products: series(products),
    devices: devices.map((d) => ({ name: d.device, value: d._count._all })),
    types: types.map((t) => ({ name: t.type, value: t._count._all })),
  });
});
