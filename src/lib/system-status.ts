import { promises as fs } from "fs";
import path from "path";
import { db } from "./db";
import { demoMode, googleConfigured } from "./config";
import { publicPaymentStatus } from "./payment-config";
import { settingsKeyAvailable } from "./secret-box";
import { mailConfigured } from "./mail";

export const APP_VERSION = process.env.npm_package_version || "1.0.0";
const started = Date.now();

export function databaseProvider() {
  const url = process.env.DATABASE_URL || "";
  return url.startsWith("mysql://") ? "mysql" : url.startsWith("file:") ? "sqlite" : "unknown";
}

export async function checkDatabase() {
  const t = Date.now();
  try {
    await db.$queryRawUnsafe("SELECT 1");
    return { ok: true, latencyMs: Date.now() - t };
  } catch {
    return { ok: false, latencyMs: Date.now() - t };
  }
}

export async function checkStorage() {
  const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
  try {
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.healthcheck-${process.pid}`);
    await fs.writeFile(probe, "ok");
    await fs.unlink(probe);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Detailed status for the admin System page. Booleans only — never secret values. */
export async function systemStatus() {
  const [database, storage, pay] = await Promise.all([checkDatabase(), checkStorage(), publicPaymentStatus().catch(() => null)]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return {
    version: APP_VERSION,
    node: process.version,
    environment: process.env.NODE_ENV,
    uptimeSec: Math.round((Date.now() - started) / 1000),
    database: { ...database, provider: databaseProvider() },
    storage,
    config: {
      appUrlSet: !!appUrl,
      appUrlHttps: appUrl.startsWith("https://"),
      authSecretStrong: (process.env.AUTH_SECRET || "").length >= 32 && !/change-me|dev-only/i.test(process.env.AUTH_SECRET || ""),
      mfaKeySet: !!process.env.MFA_ENCRYPTION_KEY,
      trustProxy: process.env.TRUST_PROXY || "off",
      rateLimitStore: process.env.RATE_LIMIT_STORE === "database" ? "database" : "memory",
      smtp: mailConfigured(),
      google: googleConfigured(),
      razorpay: !!pay?.checkoutReady,
      razorpayMode: pay?.mode ?? "test",
      razorpayWebhook: !!pay?.[pay.mode].webhookSecretConfigured,
      settingsKeySet: settingsKeyAvailable(),
      demoMode: demoMode(),
      adminEmailsVariableSet: !!process.env.ADMIN_EMAILS,
    },
  };
}
