import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { burnHash, emailSchema, verifyPassword } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, isAdminEmail, publicUser } from "@/lib/session";
import { logEvent } from "@/lib/log";

const schema = z.object({ email: emailSchema, password: z.string().min(1, "Password is required").max(200) });

export const POST = handle(async (req) => {
  const body = await readJson(req, schema);
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60 * 1000);
  rateLimit(`login:${body.email}`, 8, 15 * 60 * 1000);
  const user = await db.user.findUnique({ where: { email: body.email } });
  if (!user || !user.passwordHash) {
    await burnHash(body.password);
    throw new ApiError(401, user?.googleId ? "This account uses Google sign-in." : "Incorrect email or password.");
  }
  if (!(await verifyPassword(body.password, user.passwordHash))) {
    await logEvent("warn", "auth.login_failed", body.email, user.id);
    throw new ApiError(401, "Incorrect email or password.");
  }
  if (user.status !== "active") throw new ApiError(403, "This account has been suspended. Contact support.");
  const updated = await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), ...(isAdminEmail(user.email) && user.role !== "admin" ? { role: "admin" } : {}) },
  });
  await createSession(updated);
  return json({ user: publicUser(updated) });
});
