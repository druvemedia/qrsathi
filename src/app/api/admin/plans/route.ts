import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { planInputSchema } from "@/lib/plans";
import { adminPlanList, done, rowData, setFeatured } from "@/lib/admin-plans";
import { publicPaymentStatus } from "@/lib/payment-config";

export const GET = handle(async () => {
  await requireAdmin();
  const [plans, payments] = await Promise.all([adminPlanList(), publicPaymentStatus()]);
  return json({ plans, payments: { mode: payments.mode, enabled: payments.enabled, checkoutReady: payments.checkoutReady } });
});

/** Creates a plan as a draft (not visible on the pricing page until published). */
export const POST = handle(async (req) => {
  const admin = await requireAdmin({ superAdmin: true });
  await rateLimit(`admin-plans:${admin.id}`, 60, 15 * 60 * 1000);
  const input = await readJson(req, planInputSchema, 40_000);
  if (await db.pricingPlan.findUnique({ where: { id: input.id } })) throw new ApiError(409, `A plan with the identifier "${input.id}" already exists.`);
  await db.pricingPlan.create({ data: { id: input.id, ...rowData(input), status: "draft" } });
  if (input.featured) await setFeatured(input.id);
  await audit("admin.plan.created", { actor: admin, targetType: "plan", targetId: input.id, ip: clientIp(req), details: { name: input.name, monthlyPrice: input.monthlyPrice, annualPrice: input.annualPrice, currency: input.currency } });
  return done(json({ ok: true, id: input.id }, 201));
});
