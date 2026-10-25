import bcrypt from "bcryptjs";
import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(200));
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long")
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Use at least one letter and one number");

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

/** Constant-ish work for unknown emails so login timing doesn't reveal accounts. */
let dummyHash: Promise<string> | null = null;
export const burnHash = async (p: string) => {
  dummyHash ??= bcrypt.hash("dummy-password-for-timing", 12);
  return bcrypt.compare(p, await dummyHash).catch(() => false);
};
