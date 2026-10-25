import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "crypto";

/**
 * Authenticated encryption (AES-256-GCM) for admin-managed credentials stored in
 * the database. The key comes ONLY from SETTINGS_ENCRYPTION_KEY in the server
 * environment — never from the database — so a database dump alone can't reveal
 * the secrets. Without the key, database storage of secrets is disabled and the
 * credentials must come from environment variables.
 */
export function settingsKeyAvailable() {
  return (process.env.SETTINGS_ENCRYPTION_KEY || "").length >= 32;
}

function key(purpose: string) {
  const material = process.env.SETTINGS_ENCRYPTION_KEY || "";
  if (material.length < 32) throw new Error("SETTINGS_ENCRYPTION_KEY must be set (32+ characters) to store credentials in the database.");
  return Buffer.from(hkdfSync("sha256", material, "qrsathi-settings", purpose, 32));
}

/** `purpose` binds a ciphertext to its field (a ciphertext copied to another field won't decrypt). */
export function seal(plain: string, purpose: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(purpose), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `sb1:${iv.toString("base64url")}:${c.getAuthTag().toString("base64url")}:${ct.toString("base64url")}`;
}

export function open(stored: string, purpose: string) {
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "sb1" || !iv || !tag || !ct) throw new Error("Unknown sealed value format");
  const d = createDecipheriv("aes-256-gcm", key(purpose), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** Non-reversible fingerprint used to tie a verification result to specific credentials. */
export function fingerprint(...parts: string[]) {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 24);
}
