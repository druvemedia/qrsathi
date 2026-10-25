import { createHash } from "crypto";
import { db } from "./db";
import { redact } from "./redact";
import { logger } from "./logger";

export interface AuditActor { id?: string | null; email?: string | null }

/** IP addresses are stored as a short salted hash: enough to correlate, not to identify. */
export function hashIp(ip: string) {
  if (!ip || ip === "unknown") return "";
  return createHash("sha256").update(`${process.env.AUDIT_IP_SALT || process.env.AUTH_SECRET || ""}|ip|${ip}`).digest("hex").slice(0, 16);
}

/** Records a security event or administrator action. Never throws; details are redacted. */
export async function audit(
  action: string,
  opts: { actor?: AuditActor | null; targetType?: string; targetId?: string; details?: Record<string, unknown>; ip?: string } = {},
) {
  try {
    await db.auditLog.create({
      data: {
        action,
        actorId: opts.actor?.id ?? null,
        actorEmail: opts.actor?.email ?? "",
        targetType: opts.targetType ?? "",
        targetId: opts.targetId ?? "",
        details: opts.details ? JSON.stringify(redact(opts.details)).slice(0, 4000) : "",
        ip: hashIp(opts.ip || ""),
      },
    });
  } catch (e) {
    logger.error("audit.write_failed", { action, error: e instanceof Error ? e.message : String(e) });
  }
}
