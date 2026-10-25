import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { cancelSubscriptionFor } from "@/lib/billing";

type Ctx = { params: Promise<{ id: string }> };

/** Super-admin subscription management (cancel at period end or immediately). Audited in billing.ts. */
export const POST = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin({ superAdmin: true });
  await rateLimit(`admin-subs:${admin.id}`, 30, 15 * 60 * 1000);
  const { id } = await params;
  const { atPeriodEnd } = await readJson(req, z.object({ action: z.literal("cancel"), atPeriodEnd: z.boolean() }), 1_000);
  const sub = await db.subscription.findUnique({ where: { id } });
  if (!sub) throw new ApiError(404, "Subscription not found.");
  return json(await cancelSubscriptionFor(sub.userId, { atPeriodEnd, actor: { id: admin.id, email: admin.email }, adminAction: true }));
});
