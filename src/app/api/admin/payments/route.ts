import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listParams, paged } from "@/lib/admin-query";
import { publicPaymentStatus } from "@/lib/payment-config";

/**
 * Payment history. "paid" is recorded only from a captured payment confirmed by
 * Razorpay (API check or signed webhook). Amounts are the snapshots taken at the time.
 */
export const GET = handle(async (req) => {
  await requireAdmin();
  const { sp, skip, take, sort, order, page, pageSize, q } = listParams(req, ["createdAt", "amount", "status"] as const, "createdAt");
  const where = {
    ...(sp.get("status") ? { status: sp.get("status")! } : {}),
    ...(q ? { OR: [{ user: { email: { contains: q } } }, { providerRef: { contains: q } }] } : {}),
  };
  const [total, items, sums, status] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({ where, orderBy: { [sort]: order }, skip, take, include: { user: { select: { email: true } } } }),
    db.payment.groupBy({ by: ["status", "currency"], _sum: { amount: true, refundedAmount: true }, _count: { _all: true } }),
    publicPaymentStatus(),
  ]);
  const collected = new Map<string, number>();
  for (const s of sums) if (["paid", "partially_refunded", "refunded"].includes(s.status)) collected.set(s.currency, (collected.get(s.currency) ?? 0) + (s._sum.amount ?? 0) - (s._sum.refundedAmount ?? 0));
  return json({
    ...paged(items.map((p) => ({
      id: p.id, createdAt: p.createdAt, email: p.user.email, kind: p.kind, plan: p.plan, planName: p.planName, interval: p.interval, amount: p.amount, currency: p.currency,
      status: p.status, refundedAmount: p.refundedAmount, failureReason: p.failureReason, provider: p.provider, providerRef: p.providerRef,
    })), total, page, pageSize),
    billingConfigured: status.checkoutReady,
    mode: status.mode,
    summary: sums.map((s) => ({ status: s.status, currency: s.currency, count: s._count._all, amount: s._sum.amount || 0 })),
    netCollected: [...collected.entries()].map(([currency, amount]) => ({ currency, amount })),
  });
});
