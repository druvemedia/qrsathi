import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { audit } from "@/lib/audit";

/**
 * Razorpay webhook. Configure in the Razorpay dashboard with the event
 * `payment_link.paid` and the secret in RAZORPAY_WEBHOOK_SECRET.
 * The signature is verified against the raw body before anything changes.
 */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  // Razorpay payloads are a few KB; refuse anything large before buffering it.
  if (Number(req.headers.get("content-length") || 0) > 256_000) return new Response("Too large", { status: 413 });
  const raw = await req.text();
  if (raw.length > 256_000) return new Response("Too large", { status: 413 });
  const sig = req.headers.get("x-razorpay-signature") || "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await logEvent("warn", "billing.bad_signature", "Rejected webhook with invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (event.event !== "payment_link.paid") return new Response("ignored", { status: 200 });

  const link = event.payload?.payment_link?.entity;
  const payment = await db.payment.findUnique({ where: { providerRef: String(link?.id || "") } });
  if (!payment) return new Response("unknown link", { status: 200 });
  if (payment.status === "paid") return new Response("already processed", { status: 200 });
  if (link.status !== "paid" || Number(link.amount_paid) < payment.amount) {
    await logEvent("warn", "billing.amount_mismatch", `${payment.providerRef} paid=${link.amount_paid} expected=${payment.amount}`, payment.userId);
    return new Response("amount mismatch", { status: 200 });
  }

  const user = await db.user.findUnique({ where: { id: payment.userId } });
  if (!user) return new Response("no user", { status: 200 });
  const base = user.plan === payment.plan && user.planExpiresAt && user.planExpiresAt > new Date() ? user.planExpiresAt : new Date();
  // Razorpay retries deliveries: claim the payment atomically so a duplicate can't extend the plan twice.
  const applied = await db.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({ where: { id: payment.id, status: { not: "paid" } }, data: { status: "paid" } });
    if (claim.count !== 1) return false;
    await tx.user.update({ where: { id: user.id }, data: { plan: payment.plan, planExpiresAt: new Date(base.getTime() + 30 * 86400000) } });
    return true;
  });
  if (!applied) return new Response("already processed", { status: 200 });
  await audit("billing.plan_activated", { actor: { id: user.id }, targetType: "payment", targetId: payment.id, details: { plan: payment.plan, amountPaise: payment.amount } });
  await logEvent("info", "billing.paid", `${payment.plan} ₹${payment.amount / 100} ${payment.providerRef}`, user.id);
  return new Response("ok", { status: 200 });
}
