import { createHash } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { hashPassword, passwordSchema } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, revokeAllSessions } from "@/lib/session";
import { audit } from "@/lib/audit";

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`reset:ip:${ip}`, 10, 15 * 60 * 1000);
  await rateLimit("reset:global", 200, 15 * 60 * 1000);
  const { token, password } = await readJson(req, z.object({ token: z.string().min(20).max(200), password: passwordSchema }), 10_000);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const reset = await db.passwordReset.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || reset.user.status !== "active")
    throw new ApiError(400, "This reset link is invalid or has expired. Request a new one.");
  // Claim the token atomically so two concurrent requests can't both use it.
  const claimed = await db.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) throw new ApiError(400, "This reset link is invalid or has expired. Request a new one.");
  const user = await db.user.update({
    where: { id: reset.userId },
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
  });
  await db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await revokeAllSessions(user.id);
  await createSession(user, { kind: "user" });
  await audit("auth.password_reset", { actor: { id: user.id }, ip });
  return json({ ok: true });
});
