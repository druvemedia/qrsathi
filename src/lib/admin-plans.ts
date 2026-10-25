import { db } from "./db";
import { ApiError } from "./api";
import { invalidatePlans } from "./plan-store";
import { FREE_PLAN_ID, planFromRow, type PlanInput } from "./plans";
import { LIVE_STATES, providerSyncState } from "./billing";

/** Admin view of every plan with usage counts and provider sync state. */
export async function adminPlanList() {
  invalidatePlans();
  const [rows, users, subs] = await Promise.all([
    db.pricingPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.subscription.groupBy({ by: ["planId"], where: { status: { in: [...LIVE_STATES] } }, _count: { _all: true } }),
  ]);
  return Promise.all(rows.map(async (r) => ({
    ...planFromRow(r),
    updatedAt: r.updatedAt,
    users: users.find((u) => u.plan === r.id)?._count._all ?? 0,
    liveSubscriptions: subs.find((s) => s.planId === r.id)?._count._all ?? 0,
    sync: await providerSyncState(r.id),
  })));
}

export async function planRow(id: string) {
  const row = await db.pricingPlan.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, "Plan not found.");
  return row;
}

export const liveSubscriptionCount = (planId: string) => db.subscription.count({ where: { planId, status: { in: [...LIVE_STATES] } } });

export function rowData(p: PlanInput) {
  return {
    name: p.name, description: p.description, currency: p.currency, monthlyPrice: p.monthlyPrice, annualPrice: p.annualPrice,
    features: JSON.stringify(p.features), limits: JSON.stringify(p.limits), featured: p.featured, sortOrder: p.sortOrder,
  };
}

/** Only one plan is featured on the pricing page. */
export async function setFeatured(id: string) {
  await db.pricingPlan.updateMany({ where: { id: { not: id }, featured: true }, data: { featured: false } });
}

export function assertNotFree(id: string, what: string) {
  if (id === FREE_PLAN_ID) throw new ApiError(400, `The Free plan can't be ${what}: every account falls back to it.`);
}

export const done = <T>(v: T) => { invalidatePlans(); return v; };
