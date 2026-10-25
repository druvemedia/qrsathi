import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { emailSchema, hashPassword, passwordSchema } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, publicUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

// .strict() would reject unknown keys; instead unknown keys (e.g. "role") are stripped by zod and ignored.
const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "Please accept the Terms and Privacy Policy" }),
});

/** Public signup ALWAYS creates an ordinary user. Roles are assigned only via the admin CLI or a super administrator. */
export const POST = handle(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`signup:ip:${ip}`, 10, 60 * 60 * 1000);
  await rateLimit("signup:global", 300, 60 * 60 * 1000);
  const settings = await getSettings();
  const body = await readJson(req, schema, 10_000);
  if (!settings.allowSignups) throw new ApiError(403, "New sign-ups are currently closed.");
  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing) throw new ApiError(409, "An account with this email already exists. Try signing in.");
  const user = await db.user.create({
    data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password), role: "user", lastLoginAt: new Date() },
  });
  await createSession(user, { kind: "user" });
  await audit("auth.signup", { actor: { id: user.id }, ip });
  return json({ user: publicUser(user) }, 201);
});
