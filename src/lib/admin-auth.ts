/** Short-lived "password verified, MFA pending" tickets for the admin login's second step. */
import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "./session";

const TTL = 5 * 60;

export async function issueMfaTicket(userId: string, sessionVersion: number) {
  return new SignJWT({ p: "admin-mfa", sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(authSecret());
}

export async function readMfaTicket(ticket: string) {
  try {
    const { payload } = await jwtVerify(ticket, authSecret(), { algorithms: ["HS256"] });
    if (payload.p !== "admin-mfa" || !payload.sub) return null;
    return { userId: payload.sub, sv: Number(payload.sv) };
  } catch {
    return null;
  }
}
