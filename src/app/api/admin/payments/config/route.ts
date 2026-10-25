import { z } from "zod";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin, requireRecentAdminAuth } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { credentialsSchema, publicPaymentStatus, saveCredentials, setCheckout, verifyMode } from "@/lib/payment-config";

/** Status only — secrets are never returned (not even masked fragments). */
export const GET = handle(async () => {
  await requireAdmin();
  return json(await publicPaymentStatus());
});

/** Replace or clear credentials for one mode. Super admin + recent re-authentication. */
export const PUT = handle(async (req) => {
  const { user: admin } = await requireRecentAdminAuth({ superAdmin: true });
  await rateLimit(`admin-payments:${admin.id}`, 20, 15 * 60 * 1000);
  const input = await readJson(req, credentialsSchema, 5_000);
  let changed: string[];
  try {
    changed = await saveCredentials(input);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "storage_unavailable") throw new ApiError(409, "Credentials can't be stored in the database because SETTINGS_ENCRYPTION_KEY isn't configured on the server. Set the RAZORPAY_* environment variables instead.");
    if (m === "env_managed") throw new ApiError(409, `The ${input.mode} credentials are set by environment variables on the server. Change them there.`);
    throw e;
  }
  // Field names only — never values.
  if (changed.length) await audit("admin.payments.credentials_updated", { actor: admin, targetType: "payment_gateway", targetId: `razorpay:${input.mode}`, ip: clientIp(req), details: { fields: changed } });
  return json({ ok: true, changed, status: await publicPaymentStatus() });
});

const patchSchema = z.object({ enabled: z.boolean().optional(), mode: z.enum(["test", "live"]).optional() });

/** Enable/disable checkout or switch mode. Enabling requires complete, verified credentials. */
export const PATCH = handle(async (req) => {
  const { user: admin } = await requireRecentAdminAuth({ superAdmin: true });
  await rateLimit(`admin-payments:${admin.id}`, 20, 15 * 60 * 1000);
  const body = await readJson(req, patchSchema, 2_000);
  let result;
  try {
    result = await setCheckout(body);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "incomplete") throw new ApiError(400, "Enter the Key ID, Key Secret and Webhook Secret for this mode first.");
    if (m === "unverified") throw new ApiError(400, "Run “Test connection” successfully before enabling checkout. Unverified or rejected credentials can't take payments.");
    throw e;
  }
  await audit("admin.payments.checkout_updated", { actor: admin, targetType: "payment_gateway", targetId: "razorpay", ip: clientIp(req), details: result });
  return json({ ok: true, status: await publicPaymentStatus() });
});

/** Read-only verification against Razorpay (no plans, orders or charges are created). */
export const POST = handle(async (req) => {
  const admin = await requireAdmin({ superAdmin: true });
  await rateLimit(`admin-payments-verify:${admin.id}`, 10, 15 * 60 * 1000);
  const { mode } = await readJson(req, z.object({ action: z.literal("verify"), mode: z.enum(["test", "live"]) }), 1_000);
  const result = await verifyMode(mode);
  await audit("admin.payments.verified", { actor: admin, targetType: "payment_gateway", targetId: `razorpay:${mode}`, ip: clientIp(req), details: { result: result.status } });
  return json({ ...result, config: await publicPaymentStatus() });
});
