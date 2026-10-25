import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const GET = handle(async (req) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get("status");
  const reports = await db.abuseReport.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 });
  const codes = [...new Set(reports.map((r) => r.shortCode).filter(Boolean))];
  const qrs = await db.qrCode.findMany({
    where: { shortCode: { in: codes } },
    select: { id: true, shortCode: true, name: true, status: true, destination: true, isHosted: true, user: { select: { id: true, email: true, status: true } } },
  });
  const byCode = Object.fromEntries(qrs.map((q) => [q.shortCode, q]));
  return json({ items: reports.map((r) => ({ ...r, qr: byCode[r.shortCode] || null })) });
});
