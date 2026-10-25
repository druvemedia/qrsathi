import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, handle, json, readJson } from "@/lib/api";
import { emailSchema } from "@/lib/auth-helpers";
import { rateLimit, withinLimit } from "@/lib/rate-limit";
import { sendPasswordReset } from "@/lib/password-reset";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`forgot:ip:${ip}`, 5, 15 * 60 * 1000);
  await rateLimit("forgot:global", 200, 15 * 60 * 1000);
  const { email } = await readJson(req, z.object({ email: emailSchema }), 10_000);
  const user = await db.user.findUnique({ where: { email } });
  // Same response whether or not the account exists (no account enumeration).
  // At most 3 e-mails per account per hour (prevents mail bombing), silently.
  if (user && user.status === "active" && (await withinLimit(`forgot:acct:${user.id}`, 3, 60 * 60 * 1000))) {
    await sendPasswordReset(user, req);
    await audit("auth.password_reset_requested", { actor: { id: user.id }, ip });
  }
  return json({ ok: true, message: "If an account exists for that email, a reset link has been sent." });
});
