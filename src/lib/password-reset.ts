import { createHash, randomBytes } from "crypto";
import type { User } from "@prisma/client";
import { db } from "./db";
import { baseUrl } from "./api";
import { sendMail } from "./mail";
import { getSettings } from "./settings";

/**
 * Issues a one-time reset token (only its SHA-256 hash is stored; valid 1 hour)
 * and e-mails the link. Older unused tokens for the user are invalidated.
 * Links always use NEXT_PUBLIC_APP_URL in production (no Host-header poisoning).
 */
export async function sendPasswordReset(user: Pick<User, "id" | "email" | "name">, req?: Request) {
  const token = randomBytes(32).toString("base64url");
  await db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await db.passwordReset.create({
    data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const { siteName } = await getSettings();
  const link = `${baseUrl(req)}/reset-password?token=${token}`;
  return sendMail({
    to: user.email,
    subject: `Reset your ${siteName} password`,
    text: `Hi ${user.name || ""},\n\nUse this link to set a new password (valid for 1 hour, one use only):\n${link}\n\nIf you didn't request this, you can ignore this email — your password stays the same.`,
  });
}
