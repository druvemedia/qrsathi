import { handleRazorpayWebhook } from "@/lib/billing";

/**
 * Razorpay webhook endpoint: {NEXT_PUBLIC_APP_URL}/api/billing/webhook.
 * Subscribe to: subscription.authenticated, subscription.activated, subscription.charged,
 * subscription.pending, subscription.halted, subscription.cancelled, subscription.completed,
 * payment.failed, refund.processed (and payment_link.paid for legacy passes).
 * The signature is verified against the raw body before anything is parsed or changed.
 */
export async function POST(req: Request) {
  // Razorpay payloads are a few KB; refuse anything large before buffering it.
  if (Number(req.headers.get("content-length") || 0) > 256_000) return new Response("Too large", { status: 413 });
  const raw = await req.text();
  if (raw.length > 256_000) return new Response("Too large", { status: 413 });
  const r = await handleRazorpayWebhook(raw, req.headers.get("x-razorpay-signature") || "", req.headers.get("x-razorpay-event-id"));
  return new Response(r.body, { status: r.status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
