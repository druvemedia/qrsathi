/** Redaction helpers for logs and audit records. Isomorphic and dependency-free. */

const SECRET_KEY = /pass(word)?|secret|token|hash|otp|totp|mfa.?code|recovery|cookie|authorization|api.?key|signature/i;

/** a.b@example.com → a***@example.com (keeps the domain for triage). */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

/** Masks e-mail addresses and long token-like strings inside free text. */
export function redactText(text: string) {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => maskEmail(m))
    // JWTs / signed cookies: header.payload.signature (segments may be short).
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]*)?/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .replace(/(token|code|password|secret)=([^&\s]+)/gi, "$1=[redacted]");
}

/** Deep-copies a value replacing secret-looking keys and masking strings. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value).slice(0, 500);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}
