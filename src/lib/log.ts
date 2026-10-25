import { db } from "./db";
import { logger } from "./logger";
import { redactText } from "./redact";

/** Persists a system log entry (shown in Admin → System). Messages are redacted. Never throws. */
export async function logEvent(level: "info" | "warn" | "error", event: string, message = "", userId?: string | null) {
  const safe = redactText(message).slice(0, 2000);
  logger[level](event, { message: safe, userId: userId ?? undefined });
  try {
    await db.log.create({ data: { level, event, message: safe, userId: userId ?? null } });
  } catch (e) {
    logger.error("log.write_failed", { event, error: e instanceof Error ? e.message : String(e) });
  }
}
