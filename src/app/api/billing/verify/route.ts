import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { confirmCheckout } from "@/lib/billing";

const schema = z.object({
  razorpay_payment_id: z.string().trim().regex(/^pay_[A-Za-z0-9]{6,40}$/),
  razorpay_subscription_id: z.string().trim().regex(/^sub_[A-Za-z0-9]{6,40}$/),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/),
});

/**
 * Receives Razorpay Checkout's handler response. The signature is verified and the
 * payment is then fetched from Razorpay; the plan changes only if Razorpay reports
 * the charge as captured for the right amount. Otherwise the state stays "pending"
 * until the signed webhook arrives.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  await rateLimit(`billing-verify:${user.id}`, 20, 15 * 60 * 1000);
  const b = await readJson(req, schema, 5_000);
  return json(await confirmCheckout(user, { paymentId: b.razorpay_payment_id, subscriptionId: b.razorpay_subscription_id, signature: b.razorpay_signature }));
});
