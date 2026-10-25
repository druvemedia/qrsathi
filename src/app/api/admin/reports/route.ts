import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listParams, paged } from "@/lib/admin-query";

export const GET = handle(async (req) => {
  await requireAdmin();
  const { sp, skip, take, page, pageSize } = listParams(req, ["createdAt"] as const, "createdAt");
  const status = sp.get("status");
  const where = status ? { status } : {};
  const [total, reports] = await Promise.all([
    db.abuseReport.count({ where }),
    db.abuseReport.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
  ]);
  const codes = [...new Set(reports.map((r) => r.shortCode).filter(Boolean))];
  const qrs = await db.qrCode.findMany({
    where: { shortCode: { in: codes } },
    select: { id: true, shortCode: true, name: true, status: true, destination: true, isHosted: true, user: { select: { id: true, email: true, status: true, role: true } } },
  });
  const byCode = Object.fromEntries(qrs.map((q) => [q.shortCode, q]));
  return json(paged(reports.map((r) => ({ ...r, qr: byCode[r.shortCode] || null })), total, page, pageSize));
});
