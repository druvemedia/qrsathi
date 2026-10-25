import { createHash } from "crypto";
import { Prisma, type Subscription, type User } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { audit } from "./audit";
import { logEvent } from "./log";
import { allPlans, invalidatePlans } from "./plan-store";
import { intervalsOf, isPaid, priceFor, type Interval } from "./plans";
import { checkoutCreds, credsForMode, getPaymentConfig, recordWebhookReceived, webhookSecrets, type Mode } from "./payment-config";
import {
  RazorpayError, cancelSubscription, createPlan, createSubscription, fetchPayment, fetchSubscription,
  verifySubscriptionSignature, verifyWebhookSignature, type RzpCreds, type RzpSubscription,
} from "./razorpay";

/**
 * Razorpay subscription lifecycle. Rules:
 *  - Prices, plans and amounts come from the database, never from the client.
 *  - A paid plan is granted only after authoritative confirmation: a captured
 *    payment fetched from the Razorpay API, or a signature-verified webhook.
 *  - Every effect is idempotent (unique payment ids, provider-reported refund
 *    totals, status "set" operations) and webhook deliveries are recorded in a
 *    ledger, so retries and duplicates can't extend plans or record payments twice.
 */

export const LIVE_STATES = ["authenticated", "active", "pending"] as const;
const TOTAL_COUNT: Record<Interval, number> = { month: 120, year: 10 };
/** Access continues this long after the provider's period end, to absorb webhook delays at renewal. */
const GRACE_MS = 24 * 3600_000;

const periodEnd = (s: Pick<RzpSubscription, "current_end">, interval: string) =>
  s.current_end ? new Date(s.current_end * 1000) : new Date(Date.now() + (interval === "year" ? 365 : 30) * 86400_000);

// ---------- provider plan sync (admin) ----------

export async function providerSyncState(planId: string) {
  const [{ mode, active }, plan, rows] = await Promise.all([
    getPaymentConfig(),
    allPlans().then((ps) => ps.find((p) => p.id === planId)),
    db.providerPlan.findMany({ where: { planId, active: true } }),
  ]);
  if (!plan || !isPaid(plan)) return { mode, intervals: [] as { interval: Interval; synced: boolean; providerPlanId: string | null }[], ready: active.complete && active.verified };
  return {
    mode,
    ready: active.complete && active.verified,
    intervals: intervalsOf(plan).map((interval) => {
      const r = rows.find((x) => x.interval === interval && x.mode === mode && x.amount === priceFor(plan, interval) && x.currency === plan.currency);
      return { interval, synced: !!r, providerPlanId: r?.providerPlanId ?? null };
    }),
  };
}

/** Creates Razorpay plans for the current price/interval (never edits existing ones: Razorpay plans are immutable). */
export async function syncProviderPlans(planId: string) {
  const c = await getPaymentConfig();
  if (!c.active.complete || !c.active.verified)
    throw new ApiError(409, "Razorpay isn't configured and verified for the current mode. The plan is saved; provider synchronization is pending.");
  const creds: RzpCreds = { keyId: c.active.keyId, keySecret: c.active.keySecret };
  const plan = (await allPlans()).find((p) => p.id === planId);
  if (!plan) throw new ApiError(404, "Plan not found.");
  if (!isPaid(plan)) throw new ApiError(400, "Free plans don't need a payment-provider plan.");
  const created: { interval: Interval; providerPlanId: string }[] = [];
  for (const interval of intervalsOf(plan)) {
    const amount = priceFor(plan, interval);
    const match = await db.providerPlan.findFirst({ where: { planId, interval, mode: c.mode, amount, currency: plan.currency, active: true } });
    if (match) continue;
    let rp;
    try {
      rp = await createPlan(creds, { period: interval === "year" ? "yearly" : "monthly", amount, currency: plan.currency, name: `${plan.name} (${interval === "year" ? "yearly" : "monthly"})`, description: plan.description.slice(0, 200), notes: { planId, interval } });
    } catch (e) {
      throw new ApiError(502, e instanceof RazorpayError ? `Razorpay: ${e.message}` : "Couldn't create the plan at Razorpay.");
    }
    if (rp.item?.amount !== amount || rp.item?.currency !== plan.currency) throw new ApiError(502, "Razorpay returned a plan with a different amount or currency.");
    await db.$transaction([
      db.providerPlan.updateMany({ where: { planId, interval, mode: c.mode, active: true }, data: { active: false } }),
      db.providerPlan.create({ data: { planId, interval, amount, currency: plan.currency, mode: c.mode, providerPlanId: rp.id } }),
    ]);
    created.push({ interval, providerPlanId: rp.id });
  }
  invalidatePlans();
  return created;
}

// ---------- checkout ----------

export async function startSubscription(user: User, planId: string, interval: Interval, siteName: string) {
  const creds = await checkoutCreds();
  if (!creds) throw new ApiError(503, "Online payments aren't available right now. Please try again later or contact support.");
  const plan = (await allPlans()).find((p) => p.id === planId);
  if (!plan || plan.status !== "published" || !isPaid(plan)) throw new ApiError(404, "That plan isn't available.");
  if (!intervalsOf(plan).includes(interval)) throw new ApiError(400, `The ${plan.name} plan isn't offered ${interval === "year" ? "yearly" : "monthly"}.`);
  const live = await db.subscription.findFirst({ where: { userId: user.id, status: { in: [...LIVE_STATES] } } });
  if (live) throw new ApiError(409, `You already have a ${live.planName || live.planId} subscription (${live.status}). Cancel it in Settings → Billing before switching plans.`);
  const amount = priceFor(plan, interval);
  const pp = await db.providerPlan.findFirst({ where: { planId, interval, mode: creds.mode, amount, currency: plan.currency, active: true } });
  if (!pp) throw new ApiError(409, "This plan isn't ready for online checkout yet. Please try again later.");
  let rs: RzpSubscription;
  try {
    rs = await createSubscription(creds, { planId: pp.providerPlanId, totalCount: TOTAL_COUNT[interval], notes: { userId: user.id, planId, interval } });
  } catch (e) {
    await logEvent("error", "billing.subscription_create_failed", e instanceof RazorpayError ? `${e.kind} ${e.status} ${e.code}` : "unknown", user.id);
    throw new ApiError(502, "Couldn't start checkout with the payment provider. Please try again.");
  }
  if (rs.plan_id !== pp.providerPlanId) throw new ApiError(502, "The payment provider returned an unexpected plan.");
  const sub = await db.subscription.create({
    data: { userId: user.id, planId, planName: plan.name, interval, amount, currency: plan.currency, mode: creds.mode, providerSubscriptionId: rs.id, providerPlanId: pp.providerPlanId, status: "created" },
  });
  await audit("billing.checkout_started", { actor: { id: user.id }, targetType: "subscription", targetId: sub.id, details: { planId, interval, amount, currency: plan.currency, mode: creds.mode } });
  return {
    keyId: creds.keyId, // public identifier required by Razorpay Checkout
    subscriptionId: rs.id,
    name: siteName,
    description: `${plan.name} — ${interval === "year" ? "yearly" : "monthly"}`,
    amount, currency: plan.currency,
    prefill: { name: user.name || "", email: user.email },
  };
}

type ChargeResult = "activated" | "duplicate" | "mismatch" | "not_captured";

/** Records a captured subscription charge and grants the plan until the provider's period end. Idempotent. */
async function applyCharge(sub: Subscription, payment: { id: string; amount: number; currency: string; status: string }, rs: Pick<RzpSubscription, "current_end" | "plan_id">, source: string): Promise<ChargeResult> {
  if (payment.status !== "captured") return "not_captured";
  if (payment.amount !== sub.amount || payment.currency !== sub.currency || rs.plan_id !== sub.providerPlanId) {
    await logEvent("warn", "billing.charge_mismatch", `sub=${sub.id} source=${source} amount=${payment.amount}/${sub.amount} currency=${payment.currency}/${sub.currency}`, sub.userId);
    await audit("billing.charge_rejected", { actor: { id: sub.userId }, targetType: "subscription", targetId: sub.id, details: { reason: "amount_currency_or_plan_mismatch", source } });
    return "mismatch";
  }
  const end = periodEnd(rs, sub.interval);
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({ where: { providerRef: payment.id } });
      if (existing?.status === "paid" || existing?.status === "refunded" || existing?.status === "partially_refunded") return "duplicate" as const;
      if (existing) await tx.payment.update({ where: { id: existing.id }, data: { status: "paid", failureReason: "" } });
      else await tx.payment.create({ data: { userId: sub.userId, provider: "razorpay", providerRef: payment.id, kind: "subscription", plan: sub.planId, planName: sub.planName, interval: sub.interval, amount: payment.amount, currency: payment.currency, status: "paid", subscriptionId: sub.id } });
      const fresh = await tx.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      await tx.subscription.update({ where: { id: sub.id }, data: { status: ["cancelled", "completed"].includes(fresh.status) ? fresh.status : "active", currentPeriodEnd: end } });
      await tx.user.update({ where: { id: sub.userId }, data: { plan: sub.planId, planExpiresAt: new Date(end.getTime() + GRACE_MS) } });
      return "activated" as const;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "duplicate";
    throw e;
  }
}

/** Called from the browser after Razorpay Checkout succeeds. Activation still requires the provider's confirmation. */
export async function confirmCheckout(user: User, input: { paymentId: string; subscriptionId: string; signature: string }) {
  const sub = await db.subscription.findUnique({ where: { providerSubscriptionId: input.subscriptionId } });
  if (!sub || sub.userId !== user.id) throw new ApiError(404, "Subscription not found.");
  const creds = await credsForMode(sub.mode as Mode);
  if (!creds) throw new ApiError(503, "Payments are temporarily unavailable. If you were charged, your plan will update automatically.");
  if (!verifySubscriptionSignature(input.paymentId, input.subscriptionId, input.signature, creds.keySecret)) {
    await audit("billing.signature_invalid", { actor: { id: user.id }, targetType: "subscription", targetId: sub.id });
    throw new ApiError(400, "We couldn't verify this payment. If money was deducted, it will be confirmed or refunded automatically by Razorpay.");
  }
  let payment, rs;
  try {
    [payment, rs] = await Promise.all([fetchPayment(creds, input.paymentId), fetchSubscription(creds, input.subscriptionId)]);
  } catch {
    if (sub.status === "created") await db.subscription.update({ where: { id: sub.id }, data: { status: "authenticated" } });
    return { status: "pending" as const };
  }
  if (rs.id !== sub.providerSubscriptionId || rs.plan_id !== sub.providerPlanId) throw new ApiError(400, "Payment details don't match this subscription.");
  if (payment.status === "failed") {
    await recordFailedPayment(sub, payment.id, payment.amount, payment.currency, payment.error_description || "");
    return { status: "failed" as const };
  }
  const r = await applyCharge(sub, payment, rs, "checkout");
  if (r === "activated" || r === "duplicate") return { status: "active" as const };
  if (r === "mismatch") throw new ApiError(400, "The payment amount didn't match the plan. Your plan wasn't changed; contact support.");
  if (sub.status === "created") await db.subscription.update({ where: { id: sub.id }, data: { status: "authenticated" } });
  return { status: "pending" as const };
}

async function recordFailedPayment(sub: Subscription, paymentId: string, amount: number, currency: string, reason: string) {
  await db.payment.upsert({
    where: { providerRef: paymentId },
    create: { userId: sub.userId, provider: "razorpay", providerRef: paymentId, kind: "subscription", plan: sub.planId, planName: sub.planName, interval: sub.interval, amount, currency, status: "failed", failureReason: reason.slice(0, 300), subscriptionId: sub.id },
    update: {},
  });
}

// ---------- webhooks ----------

type WebhookResult = { status: number; body: string };

/** Verifies, de-duplicates and applies a Razorpay webhook. Never stores or logs the raw payload. */
export async function handleRazorpayWebhook(raw: string, signature: string, eventIdHeader: string | null): Promise<WebhookResult> {
  const secrets = await webhookSecrets();
  if (!secrets.length) return { status: 503, body: "Webhook not configured" };
  const match = secrets.find((s) => verifyWebhookSignature(raw, signature, s.secret));
  if (!match) {
    await logEvent("warn", "billing.bad_signature", "Rejected webhook with invalid signature");
    return { status: 400, body: "Invalid signature" };
  }
  let event: any;
  try { event = JSON.parse(raw); } catch { return { status: 400, body: "Bad JSON" }; }
  const eventType = String(event?.event || "").slice(0, 60);
  const eventId = (eventIdHeader || "").slice(0, 120) || `sha256:${createHash("sha256").update(raw).digest("hex")}`;
  await recordWebhookReceived(match.mode).catch(() => {});

  const seen = await db.webhookEvent.findUnique({ where: { provider_eventId: { provider: "razorpay", eventId } } });
  if (seen) return { status: 200, body: "duplicate" };

  const { outcome, summary } = await dispatch(eventType, event?.payload ?? {}, match.mode);
  try {
    await db.webhookEvent.create({ data: { provider: "razorpay", eventId, eventType, status: outcome, summary: summary.slice(0, 480) } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    return { status: 200, body: "duplicate" };
  }
  return { status: 200, body: outcome };
}

async function subscriptionFor(entity: any, mode: Mode) {
  const sub = entity?.id ? await db.subscription.findUnique({ where: { providerSubscriptionId: String(entity.id) } }) : null;
  if (!sub) return { sub: null, why: "unknown subscription" };
  if (sub.mode !== mode) return { sub: null, why: "mode mismatch" };
  if (entity.plan_id && entity.plan_id !== sub.providerPlanId) return { sub: null, why: "plan mismatch" };
  if (entity.notes?.userId && entity.notes.userId !== sub.userId) return { sub: null, why: "owner mismatch" };
  return { sub, why: "" };
}

async function dispatch(type: string, payload: any, mode: Mode): Promise<{ outcome: "processed" | "ignored" | "rejected"; summary: string }> {
  if (type === "payment_link.paid") return legacyPaymentLink(payload);

  if (type.startsWith("subscription.")) {
    const entity = payload?.subscription?.entity;
    const { sub, why } = await subscriptionFor(entity, mode);
    if (!sub) return { outcome: why === "unknown subscription" ? "ignored" : "rejected", summary: `${type}: ${why}` };
    const set = (data: Prisma.SubscriptionUpdateInput) => db.subscription.update({ where: { id: sub.id }, data });
    switch (type) {
      case "subscription.charged": {
        const p = payload?.payment?.entity;
        if (!p?.id) return { outcome: "rejected", summary: "charged without payment" };
        const r = await applyCharge(sub, { id: String(p.id), amount: Number(p.amount), currency: String(p.currency), status: String(p.status) }, entity, "webhook");
        if (r === "activated") await audit("billing.plan_activated", { actor: { id: sub.userId }, targetType: "subscription", targetId: sub.id, details: { planId: sub.planId, amount: sub.amount, currency: sub.currency } });
        return { outcome: r === "mismatch" || r === "not_captured" ? "rejected" : "processed", summary: `charged: ${r}` };
      }
      case "subscription.authenticated":
        if (sub.status === "created") await set({ status: "authenticated" });
        return { outcome: "processed", summary: "authenticated" };
      case "subscription.activated":
        if (!["cancelled", "completed", "expired"].includes(sub.status)) await set({ status: "active", currentPeriodEnd: periodEnd(entity, sub.interval) });
        return { outcome: "processed", summary: "activated (plan granted on charge)" };
      case "subscription.pending":
        await set({ status: "pending" });
        return { outcome: "processed", summary: "pending: renewal charge failed, retrying" };
      case "subscription.halted": {
        await set({ status: "halted" });
        await endAccessIfCurrent(sub);
        return { outcome: "processed", summary: "halted: access ended" };
      }
      case "subscription.cancelled":
        await set({ status: "cancelled", cancelAtPeriodEnd: false });
        await audit("billing.subscription_cancelled", { actor: { id: sub.userId }, targetType: "subscription", targetId: sub.id, details: { source: "webhook" } });
        return { outcome: "processed", summary: "cancelled: access until period end" };
      case "subscription.completed":
        await set({ status: "completed" });
        return { outcome: "processed", summary: "completed" };
      case "subscription.paused":
      case "subscription.resumed":
        await set({ status: type === "subscription.paused" ? "halted" : "active" });
        if (type === "subscription.paused") await endAccessIfCurrent(sub);
        return { outcome: "processed", summary: type };
      default:
        return { outcome: "ignored", summary: `unhandled ${type}` };
    }
  }

  if (type === "payment.failed") {
    const p = payload?.payment?.entity;
    const subId = p?.subscription_id || p?.notes?.subscriptionId;
    const sub = subId ? await db.subscription.findUnique({ where: { providerSubscriptionId: String(subId) } }) : null;
    if (!sub || sub.mode !== mode) return { outcome: "ignored", summary: "payment.failed: not linked to a known subscription" };
    await recordFailedPayment(sub, String(p.id), Number(p.amount), String(p.currency), String(p.error_description || ""));
    return { outcome: "processed", summary: "payment failed recorded" };
  }

  if (type === "refund.processed" || type === "refund.created") {
    const p = payload?.payment?.entity;
    const payment = p?.id ? await db.payment.findUnique({ where: { providerRef: String(p.id) } }) : null;
    if (!payment) return { outcome: "ignored", summary: "refund for unknown payment" };
    // Idempotent: use the provider's cumulative refunded amount instead of adding.
    const refunded = Math.min(payment.amount, Math.max(0, Number(p.amount_refunded) || 0));
    const full = refunded >= payment.amount;
    await db.payment.update({ where: { id: payment.id }, data: { refundedAmount: refunded, status: refunded ? (full ? "refunded" : "partially_refunded") : payment.status } });
    if (full && payment.subscriptionId) {
      const sub = await db.subscription.findUnique({ where: { id: payment.subscriptionId } });
      const latest = await db.payment.findFirst({ where: { subscriptionId: payment.subscriptionId, status: { in: ["paid", "refunded", "partially_refunded"] } }, orderBy: { createdAt: "desc" } });
      if (sub && latest?.id === payment.id) await endAccessIfCurrent(sub);
    }
    await audit("billing.refund_recorded", { actor: { id: payment.userId }, targetType: "payment", targetId: payment.id, details: { refunded, full } });
    return { outcome: "processed", summary: `refund: ${full ? "full" : "partial"}` };
  }

  return { outcome: "ignored", summary: `unhandled ${type || "event"}` };
}

/** Ends paid access now, but only if the user's current plan came from this subscription. */
async function endAccessIfCurrent(sub: Subscription) {
  const other = await db.subscription.findFirst({ where: { userId: sub.userId, id: { not: sub.id }, status: "active" } });
  if (other) return;
  await db.user.updateMany({ where: { id: sub.userId, plan: sub.planId }, data: { planExpiresAt: new Date() } });
}

/** Legacy 30-day passes bought through Payment Links before subscriptions existed. */
async function legacyPaymentLink(payload: any): Promise<{ outcome: "processed" | "ignored" | "rejected"; summary: string }> {
  const link = payload?.payment_link?.entity;
  const payment = await db.payment.findUnique({ where: { providerRef: String(link?.id || "") } });
  if (!payment) return { outcome: "ignored", summary: "unknown payment link" };
  if (payment.status === "paid") return { outcome: "processed", summary: "already processed" };
  if (link.status !== "paid" || Number(link.amount_paid) < payment.amount || (link.currency && link.currency !== payment.currency)) {
    await logEvent("warn", "billing.amount_mismatch", `${payment.providerRef} paid=${link.amount_paid} expected=${payment.amount}`, payment.userId);
    return { outcome: "rejected", summary: "amount mismatch" };
  }
  const user = await db.user.findUnique({ where: { id: payment.userId } });
  if (!user) return { outcome: "ignored", summary: "no user" };
  const base = user.plan === payment.plan && user.planExpiresAt && user.planExpiresAt > new Date() ? user.planExpiresAt : new Date();
  const applied = await db.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({ where: { id: payment.id, status: { not: "paid" } }, data: { status: "paid" } });
    if (claim.count !== 1) return false;
    await tx.user.update({ where: { id: user.id }, data: { plan: payment.plan, planExpiresAt: new Date(base.getTime() + 30 * 86400000) } });
    return true;
  });
  if (applied) await audit("billing.plan_activated", { actor: { id: user.id }, targetType: "payment", targetId: payment.id, details: { plan: payment.plan, amount: payment.amount } });
  return { outcome: "processed", summary: applied ? "payment link paid" : "already processed" };
}

// ---------- cancellation & status ----------

export async function cancelSubscriptionFor(userId: string, opts: { atPeriodEnd: boolean; actor: { id: string; email?: string }; adminAction?: boolean }) {
  const sub = await db.subscription.findFirst({ where: { userId, status: { in: [...LIVE_STATES] } }, orderBy: { createdAt: "desc" } });
  if (!sub) throw new ApiError(404, "There's no active subscription to cancel.");
  const creds = await credsForMode(sub.mode as Mode);
  if (!creds) throw new ApiError(503, "Payments are temporarily unavailable. Try again later.");
  let rs: RzpSubscription;
  try {
    rs = await cancelSubscription(creds, sub.providerSubscriptionId, opts.atPeriodEnd);
  } catch (e) {
    throw new ApiError(502, e instanceof RazorpayError ? `Couldn't cancel at Razorpay: ${e.message}` : "Couldn't cancel at the payment provider.");
  }
  const cancelledNow = rs.status === "cancelled";
  await db.subscription.update({ where: { id: sub.id }, data: cancelledNow ? { status: "cancelled", cancelAtPeriodEnd: false } : { cancelAtPeriodEnd: true } });
  if (cancelledNow && !opts.atPeriodEnd) await endAccessIfCurrent(sub);
  await audit(opts.adminAction ? "admin.subscription.cancelled" : "billing.subscription_cancel_requested", {
    actor: opts.actor, targetType: "subscription", targetId: sub.id, details: { atPeriodEnd: opts.atPeriodEnd, providerStatus: rs.status },
  });
  return { status: cancelledNow ? "cancelled" : sub.status, cancelAtPeriodEnd: !cancelledNow, currentPeriodEnd: sub.currentPeriodEnd };
}

export async function billingOverview(user: User) {
  const [subscription, payments] = await Promise.all([
    db.subscription.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return {
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    subscription: subscription && {
      id: subscription.id, planId: subscription.planId, planName: subscription.planName, interval: subscription.interval, amount: subscription.amount, currency: subscription.currency,
      status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, createdAt: subscription.createdAt,
    },
    payments: payments.map((p) => ({ id: p.id, createdAt: p.createdAt, planName: p.planName || p.plan, interval: p.interval, amount: p.amount, currency: p.currency, status: p.status, refundedAmount: p.refundedAmount, kind: p.kind })),
  };
}

/** Status of one checkout, for the post-checkout page. Reads only the database (webhooks/confirmations update it). */
export async function checkoutStatus(user: User, providerSubscriptionId: string) {
  const sub = await db.subscription.findUnique({ where: { providerSubscriptionId } });
  if (!sub || sub.userId !== user.id) throw new ApiError(404, "Subscription not found.");
  const paid = await db.payment.findFirst({ where: { subscriptionId: sub.id, status: "paid" } });
  const failed = await db.payment.findFirst({ where: { subscriptionId: sub.id, status: "failed" }, orderBy: { createdAt: "desc" } });
  const state = paid && sub.status === "active" ? "active" : ["halted", "cancelled", "expired", "completed"].includes(sub.status) ? sub.status : failed && !paid ? "failed" : "pending";
  return { state, planName: sub.planName, interval: sub.interval, currentPeriodEnd: sub.currentPeriodEnd, failureReason: failed && !paid ? failed.failureReason : "" };
}
