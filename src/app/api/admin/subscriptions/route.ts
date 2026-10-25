import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listParams, paged } from "@/lib/admin-query";
import { allPlans } from "@/lib/plan-store";
import { publicPaymentStatus } from "@/lib/payment-config";
import { LIVE_STATES } from "@/lib/billing";

/** Subscriptions (Razorpay) + plan distribution. Amounts are the recorded snapshots, not current prices. */
export const GET = handle(async (req) => {
  await requireAdmin();
  const { sp, skip, take, page, pageSize, q } = listParams(req, ["createdAt"] as const, "createdAt");
  const status = sp.get("status");
  const where: Prisma.SubscriptionWhereInput = {
    ...(status === "live" ? { status: { in: [...LIVE_STATES] } } : status ? { status } : {}),
    ...(sp.get("plan") ? { planId: sp.get("plan")! } : {}),
    ...(q ? { OR: [{ user: { email: { contains: q } } }, { providerSubscriptionId: { contains: q } }] } : {}),
  };
  const soon = new Date(Date.now() + 7 * 86400000);
  const [plans, byPlan, total, items, byStatus, renewingSoon, adminAssigned, pay] = await Promise.all([
    allPlans(),
    db.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.subscription.count({ where }),
    db.subscription.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { user: { select: { email: true, status: true } } } }),
    db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    db.subscription.count({ where: { status: "active", currentPeriodEnd: { lte: soon, gte: new Date() } } }),
    db.user.count({ where: { plan: { not: "free" }, subscriptions: { none: { status: { in: [...LIVE_STATES] } } } } }),
    publicPaymentStatus(),
  ]);
  return json({
    plans: plans.map((p) => ({ id: p.id, name: p.name, status: p.status, users: byPlan.find((b) => b.plan === p.id)?._count._all ?? 0 })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    renewingSoon,
    adminAssigned,
    billingConfigured: pay.checkoutReady,
    ...paged(items.map((s) => ({
      id: s.id, email: s.user.email, userStatus: s.user.status, planId: s.planId, planName: s.planName, interval: s.interval, amount: s.amount, currency: s.currency,
      status: s.status, mode: s.mode, currentPeriodEnd: s.currentPeriodEnd, cancelAtPeriodEnd: s.cancelAtPeriodEnd, providerSubscriptionId: s.providerSubscriptionId, createdAt: s.createdAt,
    })), total, page, pageSize),
  });
});
