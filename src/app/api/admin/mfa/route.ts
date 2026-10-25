import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/auth-helpers";
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateSecret, hashRecoveryCode, otpauthUri, verifyTotp } from "@/lib/mfa";
import { createSession, requireAdmin, revokeAllSessions } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

/** Current MFA status for the signed-in administrator (never returns the secret). */
export const GET = handle(async () => {
  const admin = await requireAdmin({ allowWithoutMfa: true });
  const remaining = await db.mfaRecoveryCode.count({ where: { userId: admin.id, usedAt: null } });
  return json({ enabled: !!admin.mfaEnabledAt, enabledAt: admin.mfaEnabledAt, recoveryCodesRemaining: remaining, required: admin.role === "super_admin" });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setup") }),
  z.object({ action: z.literal("enable"), code: z.string().trim().max(10) }),
  z.object({ action: z.literal("disable"), code: z.string().trim().max(10), password: z.string().min(1).max(200) }),
  z.object({ action: z.literal("regenerate"), code: z.string().trim().max(10) }),
]);

async function freshCodes(userId: string) {
  const codes = generateRecoveryCodes(10);
  await db.$transaction([
    db.mfaRecoveryCode.deleteMany({ where: { userId } }),
    db.mfaRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) }),
  ]);
  return codes;
}

function checkCode(user: { mfaSecret: string | null; mfaLastStep: number }, code: string) {
  if (!user.mfaSecret) return null;
  return verifyTotp(decryptSecret(user.mfaSecret), code, user.mfaLastStep);
}

/**
 * setup     → new pending secret (shown once for enrolment; not active yet)
 * enable    → verify a code from the app, activate MFA, return 10 recovery codes (shown once)
 * regenerate→ verify a code, replace recovery codes
 * disable   → requires current code + password; not allowed for super admins
 */
export const POST = handle(async (req) => {
  const admin = await requireAdmin({ allowWithoutMfa: true });
  await rateLimit(`admin-mfa-manage:${admin.id}`, 10, 15 * 60 * 1000);
  const body = await readJson(req, actionSchema, 10_000);

  if (body.action === "setup") {
    if (admin.mfaEnabledAt) throw new ApiError(400, "Two-factor authentication is already enabled.");
    const secret = generateSecret();
    await db.user.update({ where: { id: admin.id }, data: { mfaSecret: encryptSecret(secret), mfaLastStep: 0 } });
    const { siteName } = await getSettings();
    return json({ secret, otpauth: otpauthUri(secret, admin.email, `${siteName} Admin`) });
  }

  // Refuse before verifying, so a valid code isn't consumed by a forbidden action.
  if (body.action === "disable" && admin.role === "super_admin") throw new ApiError(403, "Super administrators must keep two-factor authentication enabled.");
  const step = checkCode(admin, body.code);
  if (step === null) {
    await audit("admin.mfa.code_failed", { actor: { id: admin.id, email: admin.email }, details: { action: body.action } });
    throw new ApiError(400, "That code isn't valid. Check the time on your phone and try again.");
  }
  await db.user.update({ where: { id: admin.id }, data: { mfaLastStep: step } });

  if (body.action === "enable") {
    if (admin.mfaEnabledAt) throw new ApiError(400, "Two-factor authentication is already enabled.");
    const updated = await db.user.update({ where: { id: admin.id }, data: { mfaEnabledAt: new Date(), sessionVersion: { increment: 1 } } });
    const codes = await freshCodes(admin.id);
    // Other sessions were created without MFA: end them; keep this browser signed in with an MFA session.
    await revokeAllSessions(admin.id);
    await createSession(updated, { kind: "admin", mfa: true });
    await audit("admin.mfa.enabled", { actor: { id: admin.id, email: admin.email } });
    return json({ ok: true, recoveryCodes: codes });
  }
  if (body.action === "regenerate") {
    if (!admin.mfaEnabledAt) throw new ApiError(400, "Enable two-factor authentication first.");
    const codes = await freshCodes(admin.id);
    await audit("admin.mfa.recovery_regenerated", { actor: { id: admin.id, email: admin.email } });
    return json({ ok: true, recoveryCodes: codes });
  }
  // disable
  if (!admin.passwordHash || !(await verifyPassword(body.password, admin.passwordHash))) throw new ApiError(400, "Password is incorrect.");
  await db.user.update({ where: { id: admin.id }, data: { mfaEnabledAt: null, mfaSecret: null, mfaLastStep: 0 } });
  await db.mfaRecoveryCode.deleteMany({ where: { userId: admin.id } });
  await audit("admin.mfa.disabled", { actor: { id: admin.id, email: admin.email } });
  return json({ ok: true });
});
