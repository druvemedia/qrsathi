import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { isPaid, planFromRow, planInputSchema } from "@/lib/plans";
import { syncProviderPlans } from "@/lib/billing";
import { assertNotFree, done, liveSubscriptionCount, planRow, rowData, setFeatured } from "@/lib/admin-plans";

type Ctx = { params: Promise<{ id: string }> };

const editSchema = z.object({ plan: planInputSchema, confirm: z.boolean().optional() });

/**
 * Edits a plan. Changing a price or currency never touches existing recurring
 * subscriptions: they stay on the Razorpay plan they were created with. New
 * checkouts need a new provider plan (sync). When live subscriptions exist the
 * change must be confirmed explicitly.
 */
export const PATCH = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin({ superAdmin: true });
  await rateLimit(`admin-plans:${admin.id}`, 60, 15 * 60 * 1000);
  const { id } = await params;
  const row = await planRow(id);
  const { plan, confirm } = await readJson(req, editSchema, 40_000);
  if (plan.id !== id) throw new ApiError(400, "A plan's identifier can't be changed. Duplicate it instead.");
  const before = planFromRow(row);
  const priceChanged = before.monthlyPrice !== plan.monthlyPrice || before.annualPrice !== plan.annualPrice || before.currency !== plan.currency;
  const live = priceChanged ? await liveSubscriptionCount(id) : 0;
  if (priceChanged && live && !confirm) {
    throw new ApiError(409, `${live} active subscription${live === 1 ? " keeps its" : "s keep their"} current price until cancelled. New subscribers get the new price after you sync the plan with Razorpay.`, { requiresConfirmation: true, affectedSubscriptions: live });
  }
  await db.pricingPlan.update({ where: { id }, data: rowData(plan) });
  if (plan.featured) await setFeatured(id);
  const changed = (Object.keys(plan) as (keyof typeof plan)[]).filter((k) => JSON.stringify(plan[k]) !== JSON.stringify(before[k as keyof typeof before]));
  await audit("admin.plan.updated", {
    actor: admin, targetType: "plan", targetId: id, ip: clientIp(req),
    details: { changed, ...(priceChanged ? { from: { monthly: before.monthlyPrice, annual: before.annualPrice, currency: before.currency }, to: { monthly: plan.monthlyPrice, annual: plan.annualPrice, currency: plan.currency }, liveSubscriptionsKeptOnOldPrice: live } : {}) },
  });
  return done(json({ ok: true, providerSyncRequired: priceChanged && isPaid(plan), liveSubscriptionsKeptOnOldPrice: live }));
});

const actionSchema = z.object({
  action: z.enum(["duplicate", "publish", "unpublish", "archive", "restore", "sync"]),
  newId: z.string().trim().regex(/^[a-z][a-z0-9-]{1,31}$/).optional(),
  confirm: z.boolean().optional(),
});

export const POST = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin({ superAdmin: true });
  await rateLimit(`admin-plans:${admin.id}`, 60, 15 * 60 * 1000);
  const { id } = await params;
  const row = await planRow(id);
  const { action, newId, confirm } = await readJson(req, actionSchema, 5_000);
  const log = (a: string, details: Record<string, unknown> = {}) => audit(`admin.plan.${a}`, { actor: admin, targetType: "plan", targetId: id, ip: clientIp(req), details });

  switch (action) {
    case "duplicate": {
      let target = newId || `${id}-copy`;
      for (let i = 2; !newId && (await db.pricingPlan.findUnique({ where: { id: target } })); i++) target = `${id}-copy-${i}`;
      if (await db.pricingPlan.findUnique({ where: { id: target } })) throw new ApiError(409, `A plan "${target}" already exists.`);
      await db.pricingPlan.create({ data: { ...row, id: target, name: `${row.name} (copy)`.slice(0, 40), status: "draft", featured: false, sortOrder: row.sortOrder + 1, createdAt: undefined, updatedAt: undefined } });
      await log("duplicated", { to: target });
      return done(json({ ok: true, id: target }, 201));
    }
    case "publish":
      if (row.status === "archived") throw new ApiError(400, "Restore the plan before publishing it.");
      await db.pricingPlan.update({ where: { id }, data: { status: "published" } });
      await log("published");
      return done(json({ ok: true }));
    case "unpublish":
      assertNotFree(id, "unpublished");
      await db.pricingPlan.update({ where: { id }, data: { status: "draft" } });
      await log("unpublished");
      return done(json({ ok: true }));
    case "archive": {
      assertNotFree(id, "archived");
      const live = await liveSubscriptionCount(id);
      if (live && !confirm) throw new ApiError(409, `${live} active subscription${live === 1 ? "" : "s"} will continue with ${live === 1 ? "its" : "their"} current entitlements until ${live === 1 ? "it ends" : "they end"}. The plan disappears from the pricing page.`, { requiresConfirmation: true, affectedSubscriptions: live });
      await db.pricingPlan.update({ where: { id }, data: { status: "archived", featured: false } });
      await db.providerPlan.updateMany({ where: { planId: id }, data: { active: false } });
      await log("archived", { liveSubscriptions: live });
      return done(json({ ok: true }));
    }
    case "restore":
      await db.pricingPlan.update({ where: { id }, data: { status: "draft" } });
      await log("restored");
      return done(json({ ok: true }));
    case "sync": {
      const created = await syncProviderPlans(id);
      await log("provider_synced", { created });
      return done(json({ ok: true, created }));
    }
  }
});
