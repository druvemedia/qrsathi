import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { emailSchema, hashPassword, passwordSchema } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, isAdminEmail, publicUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { logEvent } from "@/lib/log";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "Please accept the Terms and Privacy Policy" }),
});

export const POST = handle(async (req) => {
  rateLimit(`signup:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const settings = await getSettings();
  const body = await readJson(req, schema);
  if (!settings.allowSignups && !isAdminEmail(body.email)) throw new ApiError(403, "New sign-ups are currently closed.");
  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing) throw new ApiError(409, "An account with this email already exists. Try signing in.");
  const user = await db.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: isAdminEmail(body.email) ? "admin" : "user",
      lastLoginAt: new Date(),
    },
  });
  await createSession(user);
  await logEvent("info", "auth.signup", body.email, user.id);
  return json({ user: publicUser(user) }, 201);
});
