import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { readMfaTicket } from "@/lib/admin-auth";
import { decryptSecret, hashRecoveryCode, verifyTotp } from "@/lib/mfa";
import { createSession } from "@/lib/session";
import { isAdminRole } from "@/lib/roles";
import { audit } from "@/lib/audit";

const schema = z.object({
  ticket: z.string().min(20).max(2000),
  code: z.string().trim().max(10).optional(),
  recoveryCode: z.string().trim().max(40).optional(),
});

/** Step 2 of administrator sign-in: TOTP code or a one-time recovery code. */
export const POST = handle(async (req) => {
  const ip = clientIp(req);
  const body = await readJson(req, schema, 10_000);
  const t = await readMfaTicket(body.ticket);
  if (!t) throw new ApiError(401, "Your sign-in attempt expired. Start again.");
  await rateLimit(`admin-mfa:${t.userId}`, 5, 15 * 60 * 1000);
  const user = await db.user.findUnique({ where: { id: t.userId } });
  if (!user || user.status !== "active" || !isAdminRole(user.role) || user.sessionVersion !== t.sv || !user.mfaEnabledAt || !user.mfaSecret)
    throw new ApiError(401, "Your sign-in attempt expired. Start again.");

  let method = "";
  if (body.code) {
    const step = verifyTotp(decryptSecret(user.mfaSecret), body.code, user.mfaLastStep);
    if (step !== null) {
      // Atomic replay guard: only one request can advance the accepted step.
      const r = await db.user.updateMany({ where: { id: user.id, mfaLastStep: { lt: step } }, data: { mfaLastStep: step } });
      if (r.count === 1) method = "totp";
    }
  } else if (body.recoveryCode) {
    const rc = await db.mfaRecoveryCode.findUnique({ where: { codeHash: hashRecoveryCode(body.recoveryCode) } });
    if (rc && rc.userId === user.id && !rc.usedAt) {
      const r = await db.mfaRecoveryCode.updateMany({ where: { id: rc.id, usedAt: null }, data: { usedAt: new Date() } });
      if (r.count === 1) method = "recovery_code";
    }
  }
  if (!method) {
    await audit("admin.auth.mfa_failed", { actor: { id: user.id }, ip });
    throw new ApiError(401, "That code isn't valid. Check your authenticator app and try again.");
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user, { kind: "admin", mfa: true });
  await audit("admin.auth.login", { actor: { id: user.id, email: user.email }, details: { mfa: method }, ip });
  const remaining = method === "recovery_code" ? await db.mfaRecoveryCode.count({ where: { userId: user.id, usedAt: null } }) : undefined;
  return json({ ok: true, recoveryCodesRemaining: remaining });
});
