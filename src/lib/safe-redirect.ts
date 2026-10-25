/**
 * Validates a post-login "next" path. Only same-origin relative paths are
 * allowed: no scheme, no protocol-relative "//", no backslashes (browsers treat
 * "/\evil.com" like "//evil.com"), no control characters.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || typeof next !== "string") return fallback;
  if (next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://internal.invalid");
    if (u.origin !== "http://internal.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
