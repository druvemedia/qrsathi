import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";
import { done } from "@/lib/admin-plans";

export const POST = handle(async (req) => {
  const admin = await requireAdmin({ superAdmin: true });
  const { ids } = await readJson(req, z.object({ ids: z.array(z.string().max(40)).min(1).max(50) }), 5_000);
  const existing = await db.pricingPlan.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (existing.length !== new Set(ids).size) throw new ApiError(400, "Unknown plan in the new order.");
  await db.$transaction(ids.map((id, i) => db.pricingPlan.update({ where: { id }, data: { sortOrder: i } })));
  await audit("admin.plan.reordered", { actor: admin, targetType: "plan", ip: clientIp(req), details: { order: ids } });
  return done(json({ ok: true }));
});
