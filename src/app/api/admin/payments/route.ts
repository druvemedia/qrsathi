import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listParams, paged } from "@/lib/admin-query";
import { razorpayConfigured } from "@/lib/config";

/** Payment records created by checkout; "paid" only via signature-verified webhook. */
export const GET = handle(async (req) => {
  await requireAdmin();
  const { sp, skip, take, sort, order, page, pageSize } = listParams(req, ["createdAt", "amount", "status"] as const, "createdAt");
  const where = sp.get("status") ? { status: sp.get("status")! } : {};
  const [total, items, sums] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({ where, orderBy: { [sort]: order }, skip, take, include: { user: { select: { email: true } } } }),
    db.payment.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } }),
  ]);
  return json({
    ...paged(items, total, page, pageSize),
    billingConfigured: razorpayConfigured(),
    summary: sums.map((s) => ({ status: s.status, count: s._count._all, amountPaise: s._sum.amount || 0 })),
  });
});
