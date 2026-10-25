import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { baseUrl, clientIp, handle, json, readJson } from "@/lib/api";
import { emailSchema } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";

export const POST = handle(async (req) => {
  rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60 * 1000);
  const { email } = await readJson(req, z.object({ email: emailSchema }));
  const user = await db.user.findUnique({ where: { email } });
  // Same response whether or not the account exists (no account enumeration).
  if (user && user.status === "active") {
    const token = randomBytes(32).toString("base64url");
    await db.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const { siteName } = await getSettings();
    const link = `${baseUrl(req)}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: `Reset your ${siteName} password`,
      text: `Hi ${user.name || ""},\n\nUse this link to set a new password (valid for 1 hour):\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    });
  }
  return json({ ok: true, message: "If an account exists for that email, a reset link has been sent." });
});
