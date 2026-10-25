import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { status } = await readJson(req, z.object({ status: z.enum(["open", "resolved", "dismissed"]) }), 10_000);
  const r = await db.abuseReport.update({ where: { id }, data: { status } }).catch(() => null);
  if (!r) throw new ApiError(404, "Report not found.");
  await audit("admin.report.status_changed", { actor: admin, targetType: "report", targetId: id, ip: clientIp(req), details: { to: status } });
  return json({ ok: true });
});
