import { ApiError } from "./api";
import { db } from "./db";

/**
 * Fixed-window rate limiter.
 *  RATE_LIMIT_STORE=memory   (default) per-process counters — fine for one server
 *  RATE_LIMIT_STORE=database counters in the RateLimit table — consistent across
 *                            several app instances sharing one database
 */
const buckets = new Map<string, { count: number; reset: number }>();
const store = () => (process.env.RATE_LIMIT_STORE === "database" ? "database" : "memory");

function tooMany(resetAt: number): never {
  const secs = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  throw new ApiError(429, `Too many attempts. Try again in ${secs} seconds.`);
}

async function hitDatabase(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const row = await db.$transaction(async (tx) => {
    const cur = await tx.rateLimit.findUnique({ where: { key } });
    if (!cur || cur.resetAt < now) {
      return tx.rateLimit.upsert({ where: { key }, create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) }, update: { count: 1, resetAt: new Date(now.getTime() + windowMs) } });
    }
    return tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  });
  if (row.count > limit) tooMany(row.resetAt.getTime());
  // Opportunistic cleanup of expired windows.
  if (Math.random() < 0.01) await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => {});
}

/** Throws ApiError(429) when `key` exceeded `limit` hits in the current window. */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  if (store() === "database") return hitDatabase(key, limit, windowMs);
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 50_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return;
  }
  b.count++;
  if (b.count > limit) tooMany(b.reset);
}

/** Non-throwing variant for soft limits (e.g. scan recording). */
export async function withinLimit(key: string, limit: number, windowMs: number) {
  try {
    await rateLimit(key, limit, windowMs);
    return true;
  } catch {
    return false;
  }
}
