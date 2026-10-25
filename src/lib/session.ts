/**
 * Sessions & authorization.
 *
 * Two independent, server-side sessions share one user table:
 *  - qs_session  ordinary workspace session (30 days)
 *  - qs_admin    admin-console session, created only via /admin/login after
 *                role + (when enabled) MFA verification (12 hours, SameSite=Strict)
 *
 * Each cookie holds an HS256 token naming a Session row. A request is
 * authenticated only if the row exists, is unexpired, belongs to an active user
 * and matches the user's sessionVersion — so logout, password change,
 * suspension and admin revocation take effect immediately.
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Session, User } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { planById } from "./plan-store";
import { isAdminRole, isSuperAdmin } from "./roles";

export const SESSION_COOKIE = "qs_session";
export const ADMIN_COOKIE = "qs_admin";
const USER_TTL = 60 * 60 * 24 * 30; // 30 days
const ADMIN_TTL = 60 * 60 * 12; // 12 hours
const ADMIN_IDLE = 60 * 60 * 2; // admin sessions end after 2 hours without activity

export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  return new TextEncoder().encode(s);
}

type Kind = "user" | "admin";
const cookieName = (k: Kind) => (k === "admin" ? ADMIN_COOKIE : SESSION_COOKIE);

/** Creates a fresh session row + cookie (a new id on every login prevents session fixation). */
export async function createSession(user: Pick<User, "id" | "sessionVersion">, opts: { kind?: Kind; mfa?: boolean } = {}) {
  const kind = opts.kind ?? "user";
  const ttl = kind === "admin" ? ADMIN_TTL : USER_TTL;
  const jar = await cookies();
  // Replace any session this browser already holds for the same kind.
  await revokeCookieSession(kind);
  const ua = (await headers()).get("user-agent")?.slice(0, 255) ?? "";
  const session = await db.session.create({
    data: { userId: user.id, kind, mfa: !!opts.mfa, expiresAt: new Date(Date.now() + ttl * 1000), userAgent: ua },
  });
  const token = await new SignJWT({ sid: session.id, sv: user.sessionVersion, k: kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(authSecret());
  jar.set(cookieName(kind), token, {
    httpOnly: true,
    sameSite: kind === "admin" ? "strict" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttl,
  });
  return session;
}

async function readToken(kind: Kind) {
  const token = (await cookies()).get(cookieName(kind))?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.sid !== "string" || payload.k !== kind) return null;
    return payload as { sub: string; sid: string; sv: number; k: Kind };
  } catch {
    return null;
  }
}

async function revokeCookieSession(kind: Kind) {
  const p = await readToken(kind);
  if (p) await db.session.deleteMany({ where: { id: p.sid } }).catch(() => {});
}

/** Logs out the current browser for this kind (row deleted, cookie cleared). */
export async function destroySession(kind: Kind = "user") {
  await revokeCookieSession(kind);
  (await cookies()).set(cookieName(kind), "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

/** Ends every session of a user (password change/reset, suspension, admin revocation). */
export async function revokeAllSessions(userId: string, opts: { exceptSessionId?: string } = {}) {
  await db.session.deleteMany({ where: { userId, ...(opts.exceptSessionId ? { id: { not: opts.exceptSessionId } } : {}) } });
}

async function load(kind: Kind): Promise<{ user: User; session: Session } | null> {
  const p = await readToken(kind);
  if (!p) return null;
  const session = await db.session.findUnique({ where: { id: p.sid }, include: { user: true } });
  const now = new Date();
  if (!session || session.userId !== p.sub || session.kind !== kind || session.expiresAt < now) return null;
  const user = session.user;
  if (user.status !== "active" || user.sessionVersion !== p.sv) return null;
  if (kind === "admin") {
    if (!isAdminRole(user.role)) return null;
    if (now.getTime() - session.lastSeenAt.getTime() > ADMIN_IDLE * 1000) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }
    // MFA-enabled administrators must have verified MFA in this session.
    if (user.mfaEnabledAt && !session.mfa) return null;
  }
  // Touch lastSeenAt at most once a minute.
  if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } }).catch(() => {});
  }
  // Lapsed paid plans fall back to Free.
  if (user.planExpiresAt && user.planExpiresAt < now && user.plan !== "free") {
    const u = await db.user.update({ where: { id: user.id }, data: { plan: "free", planExpiresAt: null } });
    return { user: u, session };
  }
  const { user: _u, ...s } = session;
  return { user, session: s as Session };
}

/** Current signed-in, active workspace user (or null). Memoised per request. */
export const getUser = cache(async (): Promise<User | null> => (await load("user"))?.user ?? null);
export const getUserSession = cache(async () => load("user"));

/** Current admin-console session (or null). Memoised per request. */
export const getAdmin = cache(async () => load("admin"));

export async function requireUser() {
  const u = await getUser();
  if (!u) throw new ApiError(401, "Please sign in to continue.");
  return u;
}

/**
 * Admin API guard (deny by default): requires an admin-console session.
 * A normal workspace session never grants admin access, even for admins.
 * Super administrators must have MFA enabled before using admin APIs
 * (except MFA enrolment itself: pass { allowWithoutMfa: true }).
 */
export async function requireAdmin(opts: { superAdmin?: boolean; allowWithoutMfa?: boolean } = {}) {
  const a = await getAdmin();
  if (!a) throw new ApiError(401, "Administrator sign-in required.");
  if (isSuperAdmin(a.user.role) && !a.user.mfaEnabledAt && !opts.allowWithoutMfa)
    throw new ApiError(403, "Enable two-factor authentication to use the admin console.");
  if (opts.superAdmin && !isSuperAdmin(a.user.role)) throw new ApiError(403, "Super administrator access required.");
  return a.user;
}

/** Browser-safe user view. Includes the plan's entitlements so the UI can explain limits (the server still enforces them). */
/**
 * Sensitive admin actions (payment credentials, enabling live billing) need a
 * recent sign-in or re-confirmation (POST /api/admin/auth/reauth), not just a
 * valid session. Returns the admin user.
 */
export async function requireRecentAdminAuth(opts: { superAdmin?: boolean; maxAgeMs?: number } = {}) {
  const user = await requireAdmin({ superAdmin: opts.superAdmin });
  const a = await getAdmin();
  const last = Math.max(a!.session.createdAt.getTime(), a!.session.reauthAt?.getTime() ?? 0);
  if (Date.now() - last > (opts.maxAgeMs ?? 15 * 60_000)) throw new ApiError(403, "Please confirm your password to continue.", { reauthRequired: true });
  return { user, session: a!.session };
}

export async function publicUser(u: User) {
  const plan = await planById(u.plan);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    plan: plan.id,
    planName: plan.name,
    limits: plan.limits,
    planExpiresAt: u.planExpiresAt,
    hasPassword: !!u.passwordHash,
    google: !!u.googleId,
    mfaEnabled: !!u.mfaEnabledAt,
    createdAt: u.createdAt,
  };
}
export type PublicUser = Awaited<ReturnType<typeof publicUser>>;
