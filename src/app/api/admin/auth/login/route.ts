import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { emailSchema } from "@/lib/auth-helpers";
import { verifyCredentials } from "@/lib/auth-flow";
import { createSession } from "@/lib/session";
import { isAdminRole } from "@/lib/roles";
import { issueMfaTicket } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";

const schema = z.object({ email: emailSchema, password: z.string().min(1, "Password is required").max(200) });

/**
 * Step 1 of administrator sign-in. Ordinary users get the same generic error
 * as a wrong password (no hint that the account exists). If MFA is enabled,
 * returns a 5-minute ticket for /api/admin/auth/mfa instead of a session.
 */
export const POST = handle(async (req) => {
  const ip = clientIp(req);
  const body = await readJson(req, schema, 10_000);
  const user = await verifyCredentials(req, body.email, body.password, "admin");
  if (!isAdminRole(user.role)) {
    await audit("admin.auth.login_denied", { actor: { id: user.id }, details: { reason: "not_admin" }, ip });
    throw new ApiError(401, "Incorrect email or password.");
  }
  if (user.mfaEnabledAt) {
    return json({ mfaRequired: true, ticket: await issueMfaTicket(user.id, user.sessionVersion) });
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user, { kind: "admin", mfa: false });
  await audit("admin.auth.login", { actor: { id: user.id, email: user.email }, details: { mfa: false }, ip });
  // Every administrator must enrol before the console opens (the session only reaches /admin/mfa).
  return json({ ok: true, mfaSetupRequired: true });
});
