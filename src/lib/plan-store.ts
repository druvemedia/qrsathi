import { db } from "./db";
import { DEFAULT_PLANS, FREE_PLAN_ID, defaultPlan, planFromRow, type Plan } from "./plans";

/**
 * DB-backed plan catalogue with a short in-process cache (invalidated on every
 * admin change in this process; other instances pick changes up within TTL).
 */
const TTL = 10_000;
let cache: { at: number; plans: Plan[] } | null = null;
let seeding: Promise<void> | null = null;

/** Seeds the default plans once, only when the table is empty (never overwrites admin edits). */
async function seedIfEmpty() {
  if ((await db.pricingPlan.count()) > 0) return;
  for (const p of DEFAULT_PLANS) {
    await db.pricingPlan.upsert({
      where: { id: p.id },
      create: { id: p.id, name: p.name, description: p.description, currency: p.currency, monthlyPrice: p.monthlyPrice, annualPrice: p.annualPrice, features: JSON.stringify(p.features), limits: JSON.stringify(p.limits), featured: p.featured, status: p.status, sortOrder: p.sortOrder },
      update: {},
    });
  }
}

export async function allPlans(): Promise<Plan[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.plans;
  try {
    seeding ??= seedIfEmpty().finally(() => { seeding = null; });
    await seeding;
    const rows = await db.pricingPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    cache = { at: Date.now(), plans: rows.map(planFromRow) };
  } catch {
    // Database unavailable or not migrated yet: keep serving with safe defaults.
    cache = { at: Date.now(), plans: DEFAULT_PLANS };
  }
  return cache.plans;
}

export function invalidatePlans() {
  cache = null;
}

/** Entitlements for a plan id. Archived plans still apply to existing subscribers. Unknown → Free. */
export async function planById(id: string | null | undefined): Promise<Plan> {
  const plans = await allPlans();
  return plans.find((p) => p.id === id) ?? plans.find((p) => p.id === FREE_PLAN_ID) ?? defaultPlan(FREE_PLAN_ID);
}

export async function planForUser(user: { plan: string }) {
  return planById(user.plan);
}

/** Plans visible on the public pricing page. */
export async function publishedPlans() {
  return (await allPlans()).filter((p) => p.status === "published");
}
