import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, handle, json, readJson } from "@/lib/api";
import { emailSchema } from "@/lib/auth-helpers";
import { rateLimit, withinLimit } from "@/lib/rate-limit";
import { sendPasswordReset } from "@/lib/password-reset";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`forgot:ip:${ip}`, 5, 15 * 60 * 1000);
  await rateLimit("forgot:global", 200, 15 * 60 * 1000);
  const { email } = await readJson(req, z.object({ email: emailSchema }), 10_000);
  const user = await db.user.findUnique({ where: { email } });
  // Same response whether or not the account exists (no account enumeration).
  // At most 3 e-mails per account per hour (prevents mail bombing), silently.
  if (user && user.status === "active" && (await withinLimit(`forgot:acct:${user.id}`, 3, 60 * 60 * 1000))) {
    // Sent after the response so its timing doesn't reveal whether the account exists.
    // A failed send is logged (mail.failed) and never reported to the requester as success or failure.
    after(async () => {
      const sent = await sendPasswordReset(user, req).catch(() => false);
      await audit("auth.password_reset_requested", { actor: { id: user.id }, ip, details: { delivered: sent } });
      if (!sent) await logEvent("error", "auth.password_reset_mail_failed", "Password-reset e-mail could not be sent", user.id);
    });
  }
  return json({ ok: true, message: "If an account exists for that email, a reset link has been sent." });
});
