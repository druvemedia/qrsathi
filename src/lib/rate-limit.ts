import { ApiError } from "./api";

/**
 * Fixed-window in-memory rate limiter. Good for a single instance; for
 * multi-instance deployments back this with Redis/Upstash.
 */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 50_000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return;
  }
  b.count++;
  if (b.count > limit) {
    const secs = Math.ceil((b.reset - now) / 1000);
    throw new ApiError(429, `Too many attempts. Try again in ${secs} seconds.`);
  }
}
