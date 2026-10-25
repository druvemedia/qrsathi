import type { User } from "@prisma/client";
import { db } from "./db";
import { ApiError, clientIp } from "./api";
import { burnHash, verifyPassword } from "./auth-helpers";
import { rateLimit } from "./rate-limit";
import { audit } from "./audit";

const GENERIC = "Incorrect email or password.";

/**
 * Shared credential check for user and admin login.
 * - per-IP, per-account and global rate limits (IP alone is spoofable without a trusted proxy)
 * - constant-ish timing for unknown accounts, one generic error for every failure
 * - failures are audited (e-mail masked by the audit redactor)
 */
export async function verifyCredentials(req: Request, email: string, password: string, scope: "user" | "admin"): Promise<User> {
  const ip = clientIp(req);
  await rateLimit(`${scope}-login:ip:${ip}`, scope === "admin" ? 10 : 20, 15 * 60 * 1000);
  await rateLimit(`${scope}-login:acct:${email}`, scope === "admin" ? 5 : 8, 15 * 60 * 1000);
  await rateLimit(`${scope}-login:global`, scope === "admin" ? 100 : 1000, 15 * 60 * 1000);

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await burnHash(password);
    await audit(`${scope === "admin" ? "admin." : ""}auth.login_failed`, { details: { email, reason: user ? "no_password" : "unknown_account" }, ip });
    throw new ApiError(401, GENERIC);
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    await audit(`${scope === "admin" ? "admin." : ""}auth.login_failed`, { actor: { id: user.id }, details: { email, reason: "bad_password" }, ip });
    throw new ApiError(401, GENERIC);
  }
  if (user.status !== "active") {
    await audit(`${scope === "admin" ? "admin." : ""}auth.login_blocked`, { actor: { id: user.id }, details: { reason: "suspended" }, ip });
    throw new ApiError(403, "This account has been suspended. Contact support.");
  }
  return user;
}
