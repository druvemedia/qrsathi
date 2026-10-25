import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { cancelSubscriptionFor } from "@/lib/billing";

/** Cancels at the end of the paid period by default; the plan stays active until then. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  await rateLimit(`billing-cancel:${user.id}`, 10, 60 * 60 * 1000);
  const { atPeriodEnd } = await readJson(req, z.object({ atPeriodEnd: z.boolean().optional() }), 2_000);
  return json(await cancelSubscriptionFor(user.id, { atPeriodEnd: atPeriodEnd ?? true, actor: { id: user.id } }));
});
