import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { getAdmin } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/auth-helpers";
import { decryptSecret, verifyTotp } from "@/lib/mfa";
import { audit } from "@/lib/audit";

const schema = z.object({ password: z.string().min(1).max(200), code: z.string().trim().max(10).optional() });

/** Re-confirms the signed-in administrator (password, plus a TOTP code when MFA is on) for sensitive actions. */
export const POST = handle(async (req) => {
  const a = await getAdmin();
  if (!a) throw new ApiError(401, "Administrator sign-in required.");
  const ip = clientIp(req);
  await rateLimit(`admin-reauth:${a.user.id}`, 5, 15 * 60 * 1000);
  const { password, code } = await readJson(req, schema, 2_000);
  const user = a.user;
  let ok = !!user.passwordHash && (await verifyPassword(password, user.passwordHash));
  if (ok && user.mfaEnabledAt) {
    const step = code && user.mfaSecret ? verifyTotp(decryptSecret(user.mfaSecret), code, user.mfaLastStep) : null;
    ok = step !== null && (await db.user.updateMany({ where: { id: user.id, mfaLastStep: { lt: step } }, data: { mfaLastStep: step } })).count === 1;
  }
  if (!ok) {
    await audit("admin.auth.reauth_failed", { actor: { id: user.id, email: user.email }, ip });
    throw new ApiError(401, user.mfaEnabledAt ? "Password or authentication code is incorrect." : "Password is incorrect.");
  }
  await db.session.update({ where: { id: a.session.id }, data: { reauthAt: new Date() } });
  await audit("admin.auth.reauthenticated", { actor: { id: user.id, email: user.email }, ip });
  return json({ ok: true, mfaRequired: !!user.mfaEnabledAt });
});
