import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, handle, json, readJson } from "@/lib/api";
import { emailSchema } from "@/lib/auth-helpers";
import { verifyCredentials } from "@/lib/auth-flow";
import { createSession, publicUser } from "@/lib/session";
import { audit } from "@/lib/audit";

const schema = z.object({ email: emailSchema, password: z.string().min(1, "Password is required").max(200) });

/** Workspace login. Never changes roles; never grants admin-console access. */
export const POST = handle(async (req) => {
  const body = await readJson(req, schema, 10_000);
  const user = await verifyCredentials(req, body.email, body.password, "user");
  const updated = await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(updated, { kind: "user" });
  await audit("auth.login", { actor: { id: user.id }, ip: clientIp(req) });
  return json({ user: publicUser(updated) });
});
