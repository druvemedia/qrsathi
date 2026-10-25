import { createHmac, timingSafeEqual } from "crypto";

/**
 * Minimal Razorpay REST client (https://razorpay.com/docs/api/). Server-only.
 * Never logs request bodies, responses or credentials. RAZORPAY_API_BASE exists
 * only so automated tests can point at a deterministic mock server.
 */
export interface RzpCreds { keyId: string; keySecret: string }

export class RazorpayError extends Error {
  constructor(public kind: "auth" | "bad_request" | "not_found" | "rate_limited" | "server" | "timeout" | "network", public status: number, message: string, public code = "") {
    super(message);
  }
}

export const apiBase = () => (process.env.RAZORPAY_API_BASE || "https://api.razorpay.com").replace(/\/+$/, "");

async function call<T>(creds: RzpCreds, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new RazorpayError(timeout ? "timeout" : "network", 0, timeout ? "Razorpay didn't respond in time." : "Couldn't reach Razorpay.");
  }
  const data = (await res.json().catch(() => ({}))) as any;
  if (res.ok) return data as T;
  // Provider error descriptions are short, non-sensitive messages; truncate defensively.
  const desc = String(data?.error?.description || "").slice(0, 160);
  const code = String(data?.error?.code || "").slice(0, 60);
  if (res.status === 401) throw new RazorpayError("auth", 401, "Razorpay rejected the Key ID / Key Secret.", code);
  if (res.status === 404) throw new RazorpayError("not_found", 404, desc || "Not found at Razorpay.", code);
  if (res.status === 429) throw new RazorpayError("rate_limited", 429, "Razorpay rate limit reached. Try again shortly.", code);
  if (res.status >= 500) throw new RazorpayError("server", res.status, "Razorpay is having problems. Try again later.", code);
  throw new RazorpayError("bad_request", res.status, desc || `Razorpay returned ${res.status}.`, code);
}

export interface RzpPlan { id: string; period: string; interval: number; item: { amount: number; currency: string } }
export interface RzpSubscription { id: string; plan_id: string; status: string; current_start?: number | null; current_end?: number | null; notes?: Record<string, string>; short_url?: string }
export interface RzpPayment { id: string; amount: number; currency: string; status: string; order_id?: string | null; invoice_id?: string | null; error_description?: string | null; notes?: Record<string, string> | unknown[] }

/** Read-only call used to check credentials: lists at most one plan. Creates nothing. */
export const verifyCredentials = (c: RzpCreds) => call<{ items: unknown[] }>(c, "GET", "/v1/plans?count=1");

export const createPlan = (c: RzpCreds, p: { period: "monthly" | "yearly"; amount: number; currency: string; name: string; description: string; notes: Record<string, string> }) =>
  call<RzpPlan>(c, "POST", "/v1/plans", { period: p.period, interval: 1, item: { name: p.name, amount: p.amount, currency: p.currency, description: p.description }, notes: p.notes });

export const createSubscription = (c: RzpCreds, s: { planId: string; totalCount: number; notes: Record<string, string> }) =>
  call<RzpSubscription>(c, "POST", "/v1/subscriptions", { plan_id: s.planId, total_count: s.totalCount, customer_notify: 1, notes: s.notes });

export const fetchSubscription = (c: RzpCreds, id: string) => call<RzpSubscription>(c, "GET", `/v1/subscriptions/${encodeURIComponent(id)}`);
export const fetchPayment = (c: RzpCreds, id: string) => call<RzpPayment>(c, "GET", `/v1/payments/${encodeURIComponent(id)}`);
export const cancelSubscription = (c: RzpCreds, id: string, atCycleEnd: boolean) =>
  call<RzpSubscription>(c, "POST", `/v1/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: atCycleEnd ? 1 : 0 });

function safeEqualHex(expected: string, given: string) {
  const a = Buffer.from(expected, "utf8"), b = Buffer.from(given || "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout (subscriptions): HMAC_SHA256(payment_id + "|" + subscription_id, key_secret). */
export function verifySubscriptionSignature(paymentId: string, subscriptionId: string, signature: string, keySecret: string) {
  return safeEqualHex(createHmac("sha256", keySecret).update(`${paymentId}|${subscriptionId}`).digest("hex"), signature);
}

/** Webhooks: HMAC_SHA256(raw request body, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string) {
  return safeEqualHex(createHmac("sha256", webhookSecret).update(rawBody).digest("hex"), signature);
}

export const modeOfKey = (keyId: string): "test" | "live" | null => (keyId.startsWith("rzp_test_") ? "test" : keyId.startsWith("rzp_live_") ? "live" : null);
