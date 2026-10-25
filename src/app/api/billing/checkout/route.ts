import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, baseUrl, handle, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { PLANS } from "@/lib/plans";
import { razorpayConfigured } from "@/lib/config";
import { logEvent } from "@/lib/log";

/**
 * Creates a Razorpay Payment Link for a 30-day plan. The plan is NOT changed
 * here — only the signature-verified webhook (payment_link.paid) upgrades it.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const { plan } = await readJson(req, z.object({ plan: z.enum(["pro", "business"]) }));
  if (!razorpayConfigured())
    throw new ApiError(503, "Online billing isn't configured on this server yet. Contact the site admin to change your plan.");
  const p = PLANS[plan];
  const amount = p.priceInr * 100;
  const reference = `qs_${user.id.slice(-8)}_${Date.now()}`;
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      description: `${p.name} plan — 30 days`,
      reference_id: reference,
      customer: { name: user.name || user.email, email: user.email },
      notify: { email: true },
      callback_url: `${baseUrl(req)}/dashboard/settings?billing=return`,
      callback_method: "get",
      notes: { userId: user.id, plan },
    }),
  });
  if (!res.ok) {
    await logEvent("error", "billing.link_failed", `${res.status} ${await res.text()}`.slice(0, 500), user.id);
    throw new ApiError(502, "Could not start checkout with the payment provider. Please try again.");
  }
  const link = (await res.json()) as { id: string; short_url: string };
  await db.payment.create({ data: { userId: user.id, provider: "razorpay", providerRef: link.id, plan, amount, status: "created" } });
  return json({ url: link.short_url });
});
