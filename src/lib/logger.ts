/**
 * Structured logger: one JSON object per line on stdout/stderr (production),
 * readable lines in development. Every field passes through redact() so
 * passwords, tokens and e-mail addresses never reach log files.
 */
import { redact } from "./redact";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = ORDER[(process.env.LOG_LEVEL as Level) || "info"] ?? 20;
const json = process.env.LOG_FORMAT ? process.env.LOG_FORMAT === "json" : process.env.NODE_ENV === "production";

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (ORDER[level] < threshold) return;
  const rec = { time: new Date().toISOString(), level, event, ...(redact(fields) as Record<string, unknown>) };
  const line = json ? JSON.stringify(rec) : `[${level}] ${event} ${Object.keys(fields).length ? JSON.stringify(rec).slice(0, 2000) : ""}`;
  (level === "error" || level === "warn" ? console.error : console.log)(line);
}

export const logger = {
  debug: (e: string, f?: Record<string, unknown>) => write("debug", e, f),
  info: (e: string, f?: Record<string, unknown>) => write("info", e, f),
  warn: (e: string, f?: Record<string, unknown>) => write("warn", e, f),
  error: (e: string, f?: Record<string, unknown>) => write("error", e, f),
};
