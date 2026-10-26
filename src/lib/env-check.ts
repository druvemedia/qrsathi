/**
 * Startup configuration validation. Pure function so it can be unit-tested;
 * called from src/instrumentation.ts when the Node server boots.
 * Returns problems that must stop a production server, and warnings.
 */
const WEAK_SECRET = /change-me|changeme|dev-only|example|secret123|^(.)\1+$/i;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function checkEnv(env: Record<string, string | undefined>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = env.NODE_ENV === "production";
  // A production server on a real (non-localhost) origin. Local production builds used by the
  // automated test suites get warnings instead of hard failures for the test-only settings below.
  let publicProd = false;
  try { publicProd = prod && !LOCAL_HOSTS.has(new URL(env.NEXT_PUBLIC_APP_URL || "").hostname); } catch {}

  const secret = env.AUTH_SECRET || "";
  if (secret.length < 32) errors.push("AUTH_SECRET must be a random string of at least 32 characters.");
  else if (WEAK_SECRET.test(secret)) (prod ? errors : warnings).push("AUTH_SECRET looks like a placeholder. Generate a random value.");

  if (!env.DATABASE_URL) errors.push("DATABASE_URL is not set.");
  else if (!/^(file:|mysql:\/\/)/.test(env.DATABASE_URL)) errors.push("DATABASE_URL must start with mysql:// (production) or file: (SQLite development). Other databases aren't supported.");
  else if (env.DATABASE_URL.startsWith("file:") && publicProd && env.ALLOW_SQLITE_IN_PRODUCTION !== "true")
    errors.push("Production is configured with SQLite. Use MySQL (see docs/DATABASE.md), or set ALLOW_SQLITE_IN_PRODUCTION=true to accept a single-server SQLite deployment.");
  else if (prod && env.DATABASE_URL.startsWith("file:")) warnings.push("Production is using SQLite. Use MySQL for multi-instance or high-traffic deployments (see docs/DATABASE.md).");

  const app = env.NEXT_PUBLIC_APP_URL || "";
  if (!app) (prod ? errors : warnings).push("NEXT_PUBLIC_APP_URL is not set (needed for reset links, OAuth callbacks and QR short links).");
  else {
    try {
      const u = new URL(app);
      if (u.protocol !== "https:" && prod && !LOCAL_HOSTS.has(u.hostname)) errors.push("NEXT_PUBLIC_APP_URL must use https:// in production.");
      if (u.pathname !== "/" || u.search || u.hash) warnings.push("NEXT_PUBLIC_APP_URL should be an origin only (no path, query or fragment).");
    } catch {
      errors.push("NEXT_PUBLIC_APP_URL is not a valid URL.");
    }
  }

  if (prod && env.DEMO_MODE === "true") errors.push("DEMO_MODE must not be enabled in production.");
  if (env.ADMIN_EMAILS) warnings.push("ADMIN_EMAILS is no longer used and grants nothing. Create administrators with `npm run admin`. Remove the variable.");
  if (!env.MFA_ENCRYPTION_KEY) (prod ? warnings : []).push("MFA_ENCRYPTION_KEY is not set; MFA secrets are encrypted with a key derived from AUTH_SECRET. Set a separate key so rotating AUTH_SECRET doesn't break MFA.");
  else if (env.MFA_ENCRYPTION_KEY.length < 32) errors.push("MFA_ENCRYPTION_KEY must be at least 32 characters.");
  if (prod && env.RATE_LIMIT_STORE !== "database") warnings.push("RATE_LIMIT_STORE is 'memory': limits reset on restart and aren't shared between instances. Use 'database' when running more than one instance.");
  if (env.TRUST_PROXY && !["true", "cloudflare"].includes(env.TRUST_PROXY)) errors.push("TRUST_PROXY must be 'true', 'cloudflare' or unset.");
  if (!!env.RAZORPAY_KEY_ID !== !!env.RAZORPAY_KEY_SECRET) warnings.push("Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (or neither).");
  if (env.RAZORPAY_KEY_ID && !/^rzp_(test|live)_[A-Za-z0-9]{8,32}$/.test(env.RAZORPAY_KEY_ID)) errors.push("RAZORPAY_KEY_ID must look like rzp_test_… or rzp_live_….");
  if (env.SETTINGS_ENCRYPTION_KEY) {
    if (env.SETTINGS_ENCRYPTION_KEY.length < 32) errors.push("SETTINGS_ENCRYPTION_KEY must be at least 32 characters.");
    else if (env.SETTINGS_ENCRYPTION_KEY === env.AUTH_SECRET) errors.push("SETTINGS_ENCRYPTION_KEY must be different from AUTH_SECRET.");
  }
  if (prod && env.RAZORPAY_API_BASE && !/^https:\/\/api\.razorpay\.com\/?$/.test(env.RAZORPAY_API_BASE))
    (publicProd ? errors : warnings).push("RAZORPAY_API_BASE overrides the Razorpay API address. It exists for automated tests only — unset it in production.");
  if (env.RAZORPAY_KEY_ID && !env.RAZORPAY_WEBHOOK_SECRET) (prod ? errors : warnings).push("RAZORPAY_WEBHOOK_SECRET is required when Razorpay is enabled (plans are upgraded only by the signed webhook).");
  if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET) warnings.push("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or neither).");
  if (prod && !env.SMTP_HOST) {
    if (publicProd && env.MAIL_DISABLED !== "true")
      errors.push("SMTP is not configured, so password-reset e-mails can't be delivered. Set SMTP_HOST (see .env.example), or set MAIL_DISABLED=true to run without e-mail on purpose.");
    else warnings.push("SMTP is not configured: password-reset e-mails and the contact form are unavailable.");
  }

  // Anything secret must never be exposed to the browser bundle.
  for (const k of Object.keys(env)) {
    if (k.startsWith("NEXT_PUBLIC_") && /SECRET|PASSWORD|PASS$|PRIVATE|TOKEN|KEY_SECRET|DATABASE/i.test(k))
      errors.push(`${k} looks like a secret but NEXT_PUBLIC_* variables are sent to every browser. Rename it.`);
  }
  return { errors, warnings };
}
