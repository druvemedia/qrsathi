import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { getPlan } from "./plans";

export const SESSION_COOKIE = "qs_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  return new TextEncoder().encode(s);
}

export async function createSession(user: Pick<User, "id" | "sessionVersion">) {
  const token = await new SignJWT({ sv: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(authSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

/** Current signed-in, active user (or null). Memoised per request. */
export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (!payload.sub) return null;
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "active" || user.sessionVersion !== payload.sv) return null;
    // Lapsed paid plans fall back to Free.
    if (user.planExpiresAt && user.planExpiresAt < new Date() && user.plan !== "free") {
      return db.user.update({ where: { id: user.id }, data: { plan: "free", planExpiresAt: null } });
    }
    return user;
  } catch {
    return null;
  }
});

export async function requireUser() {
  const u = await getUser();
  if (!u) throw new ApiError(401, "Please sign in to continue.");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") throw new ApiError(403, "Admin access required.");
  return u;
}

export function publicUser(u: User) {
  const plan = getPlan(u.plan);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    plan: plan.id,
    planName: plan.name,
    planExpiresAt: u.planExpiresAt,
    hasPassword: !!u.passwordHash,
    google: !!u.googleId,
    createdAt: u.createdAt,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;
