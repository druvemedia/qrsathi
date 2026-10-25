import { db } from "./db";

/** Persists an audit/system log entry. Never throws. */
export async function logEvent(level: "info" | "warn" | "error", event: string, message = "", userId?: string | null) {
  try {
    await db.log.create({ data: { level, event, message: message.slice(0, 2000), userId: userId ?? null } });
  } catch (e) {
    console.error("[log] failed to write log", e);
  }
}
