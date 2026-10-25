import { z } from "zod";
import { db } from "./db";
import { fingerprint, open, seal, settingsKeyAvailable } from "./secret-box";
import { modeOfKey, verifyCredentials, RazorpayError, type RzpCreds } from "./razorpay";

/**
 * Razorpay configuration. Credentials come from (in order of precedence):
 *   1. environment variables RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
 *      (the mode — test/live — is taken from the key prefix), or
 *   2. admin-entered values stored in the Setting table, secrets sealed with
 *      SETTINGS_ENCRYPTION_KEY (available only when that key is configured).
 * Test and live credentials are stored separately. Secrets never leave the
 * server: `publicPaymentStatus()` returns only configured/verified flags.
 */
export type Mode = "test" | "live";
const KEY = "payments.razorpay";

export type CheckStatus = "verified" | "invalid" | "unable";
interface StoredModeCreds {
  keyId?: string;
  keySecret?: string; // sealed
  webhookSecret?: string; // sealed
  updatedAt?: string;
  verifiedAt?: string;
  verifiedFp?: string;
  lastCheck?: { status: CheckStatus; message: string; at: string; fp: string };
  lastWebhookAt?: string;
}
interface Stored { enabled: boolean; mode: Mode; test: StoredModeCreds; live: StoredModeCreds }
const EMPTY: Stored = { enabled: false, mode: "test", test: {}, live: {} };

async function readStored(): Promise<Stored> {
  const rows = await db.setting.findMany({ where: { key: { in: [KEY, `${KEY}.lastWebhook.test`, `${KEY}.lastWebhook.live`] } } }).catch(() => []);
  const row = rows.find((r) => r.key === KEY);
  let out: Stored = structuredClone(EMPTY);
  if (row) {
    try {
      const v = JSON.parse(row.value);
      out = { enabled: !!v.enabled, mode: v.mode === "live" ? "live" : "test", test: v.test || {}, live: v.live || {} };
    } catch {}
  }
  for (const m of ["test", "live"] as const) {
    const w = rows.find((r) => r.key === `${KEY}.lastWebhook.${m}`);
    if (w) out[m].lastWebhookAt = w.value;
  }
  return out;
}

async function writeStored(s: Stored) {
  const strip = (m: StoredModeCreds) => { const { lastWebhookAt: _w, ...rest } = m; return rest; };
  const value = JSON.stringify({ ...s, test: strip(s.test), live: strip(s.live) });
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

export interface ModeCreds {
  mode: Mode;
  source: "environment" | "database" | "none";
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  complete: boolean;
  fp: string;
  verified: boolean;
  stored: StoredModeCreds;
}

function envCreds(mode: Mode) {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  if (!keyId || modeOfKey(keyId) !== mode) return null;
  return { keyId, keySecret: process.env.RAZORPAY_KEY_SECRET || "", webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "" };
}

function resolve(mode: Mode, stored: Stored): ModeCreds {
  const st = stored[mode];
  const env = envCreds(mode);
  let keyId = "", keySecret = "", webhookSecret = "", source: ModeCreds["source"] = "none";
  if (env) {
    ({ keyId, keySecret, webhookSecret } = env);
    source = "environment";
  } else if (st.keyId || st.keySecret || st.webhookSecret) {
    source = "database";
    keyId = st.keyId || "";
    try {
      if (st.keySecret) keySecret = open(st.keySecret, `razorpay.${mode}.keySecret`);
      if (st.webhookSecret) webhookSecret = open(st.webhookSecret, `razorpay.${mode}.webhookSecret`);
    } catch {
      // Key missing/changed: treat as not configured rather than failing requests.
      keySecret = keySecret || "";
    }
  }
  const complete = !!(keyId && keySecret && webhookSecret);
  const fp = complete ? fingerprint(keyId, keySecret) : "";
  return { mode, source, keyId, keySecret, webhookSecret, complete, fp, verified: complete && st.verifiedFp === fp, stored: st };
}

export async function getPaymentConfig() {
  const stored = await readStored();
  const test = resolve("test", stored), live = resolve("live", stored);
  const active = stored.mode === "live" ? live : test;
  return { enabled: stored.enabled, mode: stored.mode, active, test, live, stored };
}

/** Checkout is offered only when enabled AND the active mode's credentials are complete and verified. */
export async function checkoutCreds(): Promise<(RzpCreds & { mode: Mode }) | null> {
  const c = await getPaymentConfig();
  if (!c.enabled || !c.active.complete || !c.active.verified) return null;
  return { keyId: c.active.keyId, keySecret: c.active.keySecret, mode: c.mode };
}

/** Webhook secrets for both modes (Razorpay test and live webhooks are configured separately). */
export async function webhookSecrets() {
  const c = await getPaymentConfig();
  const out = [c.test, c.live].filter((m) => m.webhookSecret).map((m) => ({ mode: m.mode, secret: m.webhookSecret }));
  // A webhook secret set in the environment without a key id is treated as test mode.
  const envSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (envSecret && !out.some((o) => o.secret === envSecret)) out.push({ mode: modeOfKey(process.env.RAZORPAY_KEY_ID || "") ?? "test", secret: envSecret });
  return out;
}

export async function credsForMode(mode: Mode): Promise<RzpCreds | null> {
  const m = (await getPaymentConfig())[mode];
  return m.keyId && m.keySecret ? { keyId: m.keyId, keySecret: m.keySecret } : null;
}

/** Stored under its own key so a webhook can never overwrite a concurrent credential change. */
export async function recordWebhookReceived(mode: Mode) {
  const key = `${KEY}.lastWebhook.${mode}`, value = new Date().toISOString();
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

// ---------- status for the admin UI (never includes secrets) ----------

export type ConfigStatus = "missing" | "incomplete" | "unverified" | "verified" | "invalid" | "unable";

function modeStatus(m: ModeCreds): ConfigStatus {
  if (m.source === "none") return "missing";
  if (!m.complete) return "incomplete";
  if (m.verified) return "verified";
  const lc = m.stored.lastCheck;
  if (lc && lc.fp === m.fp) return lc.status === "invalid" ? "invalid" : "unable";
  return "unverified";
}

export async function publicPaymentStatus() {
  const c = await getPaymentConfig();
  const view = (m: ModeCreds) => ({
    mode: m.mode,
    source: m.source,
    keyId: m.keyId, // Key ID is a public identifier (it is sent to Razorpay Checkout in the browser)
    keySecretConfigured: !!m.keySecret,
    webhookSecretConfigured: !!m.webhookSecret,
    status: modeStatus(m),
    verifiedAt: m.verified ? m.stored.verifiedAt ?? null : null,
    lastCheck: m.stored.lastCheck && m.stored.lastCheck.fp === m.fp ? { status: m.stored.lastCheck.status, message: m.stored.lastCheck.message, at: m.stored.lastCheck.at } : null,
    lastWebhookAt: m.stored.lastWebhookAt ?? null,
    updatedAt: m.stored.updatedAt ?? null,
  });
  return {
    enabled: c.enabled,
    mode: c.mode,
    checkoutReady: c.enabled && c.active.complete && c.active.verified,
    storageAvailable: settingsKeyAvailable(),
    test: view(c.test),
    live: view(c.live),
  };
}

// ---------- admin mutations ----------

export const credentialsSchema = z.object({
  mode: z.enum(["test", "live"]),
  keyId: z.string().trim().max(64).optional(),
  keySecret: z.string().trim().max(128).optional(),
  webhookSecret: z.string().trim().max(128).optional(),
  clear: z.array(z.enum(["keyId", "keySecret", "webhookSecret"])).max(3).optional(),
}).superRefine((v, ctx) => {
  if (v.keyId) {
    if (!/^rzp_(test|live)_[A-Za-z0-9]{8,32}$/.test(v.keyId)) ctx.addIssue({ code: "custom", path: ["keyId"], message: "Key ID looks like rzp_test_… or rzp_live_…" });
    else if (modeOfKey(v.keyId) !== v.mode) ctx.addIssue({ code: "custom", path: ["keyId"], message: `This is a ${modeOfKey(v.keyId)} key; it can't be saved as ${v.mode} credentials.` });
  }
  if (v.keySecret && !/^[A-Za-z0-9]{16,64}$/.test(v.keySecret)) ctx.addIssue({ code: "custom", path: ["keySecret"], message: "Key Secret should be 16–64 letters and digits" });
  if (v.webhookSecret && !/^\S{8,128}$/.test(v.webhookSecret)) ctx.addIssue({ code: "custom", path: ["webhookSecret"], message: "Webhook secret must be 8–128 characters without spaces" });
});

/** Returns the names of fields changed (never values) for the audit log. */
export async function saveCredentials(input: z.infer<typeof credentialsSchema>) {
  if (!settingsKeyAvailable()) throw new Error("storage_unavailable");
  if (envCreds(input.mode)) throw new Error("env_managed");
  const s = await readStored();
  const m = s[input.mode];
  const changed: string[] = [];
  for (const f of input.clear ?? []) { if (m[f]) { delete m[f]; changed.push(`${f}:cleared`); } }
  if (input.keyId && input.keyId !== m.keyId) { m.keyId = input.keyId; changed.push("keyId"); }
  if (input.keySecret) { m.keySecret = seal(input.keySecret, `razorpay.${input.mode}.keySecret`); changed.push("keySecret"); }
  if (input.webhookSecret) { m.webhookSecret = seal(input.webhookSecret, `razorpay.${input.mode}.webhookSecret`); changed.push("webhookSecret"); }
  if (changed.length) m.updatedAt = new Date().toISOString();
  // A new Key ID / Key Secret must be verified again before it can take payments.
  // (Verification covers only these two; the webhook secret is confirmed by signed deliveries.)
  if (changed.some((c) => c.startsWith("keyId") || c.startsWith("keySecret"))) {
    delete m.verifiedAt; delete m.verifiedFp; delete m.lastCheck;
    if (s.mode === input.mode) s.enabled = false;
  }
  await writeStored(s);
  return changed;
}

/** Read-only verification against Razorpay. Never creates objects or charges. */
export async function verifyMode(mode: Mode) {
  const c = await getPaymentConfig();
  const m = c[mode];
  const s = await readStored();
  const at = new Date().toISOString();
  if (!m.keyId || !m.keySecret) return { status: "incomplete" as const, message: "Enter the Key ID and Key Secret first." };
  let result: { status: CheckStatus; message: string };
  try {
    await verifyCredentials({ keyId: m.keyId, keySecret: m.keySecret });
    result = { status: "verified", message: `Razorpay accepted these ${mode} credentials (read-only check; nothing was created or charged).` };
  } catch (e) {
    result = e instanceof RazorpayError && e.kind === "auth"
      ? { status: "invalid", message: "Razorpay rejected the Key ID / Key Secret." }
      : { status: "unable", message: e instanceof RazorpayError ? `Couldn't verify: ${e.message}` : "Couldn't verify the credentials." };
  }
  const fp = fingerprint(m.keyId, m.keySecret);
  s[mode].lastCheck = { ...result, at, fp };
  if (result.status === "verified") { s[mode].verifiedAt = at; s[mode].verifiedFp = fp; } else { delete s[mode].verifiedAt; delete s[mode].verifiedFp; }
  if (result.status !== "verified" && s.mode === mode) s.enabled = false;
  await writeStored(s);
  return { ...result, webhookNote: m.webhookSecret ? "The webhook secret can't be checked from here: it's confirmed when Razorpay delivers a correctly signed event." : "Webhook secret missing: payments can't be confirmed without it." };
}

export async function setCheckout(opts: { enabled?: boolean; mode?: Mode }) {
  const s = await readStored();
  const mode = opts.mode ?? s.mode;
  const enabled = opts.enabled ?? s.enabled;
  if (enabled) {
    const m = resolve(mode, s);
    if (!m.complete) throw new Error("incomplete");
    if (!m.verified) throw new Error("unverified");
  }
  s.mode = mode;
  s.enabled = enabled;
  await writeStored(s);
  return { mode, enabled };
}
