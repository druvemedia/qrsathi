import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { hashPassword, passwordSchema } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { logEvent } from "@/lib/log";

export const POST = handle(async (req) => {
  rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60 * 1000);
  const { token, password } = await readJson(req, z.object({ token: z.string().min(20).max(200), password: passwordSchema }));
  const reset = await db.passwordReset.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    include: { user: true },
  });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || reset.user.status !== "active")
    throw new ApiError(400, "This reset link is invalid or has expired. Request a new one.");
  const user = await db.user.update({
    where: { id: reset.userId },
    // Bumping sessionVersion signs out every other device.
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
  });
  await db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await createSession(user);
  await logEvent("info", "auth.password_reset", user.email, user.id);
  return json({ ok: true });
});
