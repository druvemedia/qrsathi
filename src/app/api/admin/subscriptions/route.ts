import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listParams, paged } from "@/lib/admin-query";
import { PLANS } from "@/lib/plans";
import { razorpayConfigured } from "@/lib/config";

/** Plan catalogue + accounts on paid plans (billing-provider status reported honestly). */
export const GET = handle(async (req) => {
  await requireAdmin();
  const { sp, skip, take, page, pageSize } = listParams(req, ["planExpiresAt"] as const, "planExpiresAt");
  const plan = sp.get("plan");
  const where = { plan: plan && plan !== "all" ? plan : { not: "free" } };
  const soon = new Date(Date.now() + 7 * 86400000);
  const [byPlan, total, items, expiringSoon, adminAssigned] = await Promise.all([
    db.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.user.count({ where }),
    db.user.findMany({ where, skip, take, orderBy: [{ planExpiresAt: "asc" }, { createdAt: "desc" }], select: { id: true, email: true, name: true, plan: true, planExpiresAt: true, status: true } }),
    db.user.count({ where: { plan: { not: "free" }, planExpiresAt: { lte: soon, gte: new Date() } } }),
    db.user.count({ where: { plan: { not: "free" }, planExpiresAt: null } }),
  ]);
  return json({
    plans: Object.values(PLANS).map((p) => ({ id: p.id, name: p.name, priceInr: p.priceInr, users: byPlan.find((b) => b.plan === p.id)?._count._all ?? 0 })),
    billingConfigured: razorpayConfigured(),
    expiringSoon,
    adminAssigned,
    ...paged(items, total, page, pageSize),
  });
});
