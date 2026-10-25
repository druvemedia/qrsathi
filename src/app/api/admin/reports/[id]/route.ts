import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { logEvent } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { status } = await readJson(req, z.object({ status: z.enum(["open", "resolved", "dismissed"]) }));
  const r = await db.abuseReport.update({ where: { id }, data: { status } }).catch(() => null);
  if (!r) throw new ApiError(404, "Report not found.");
  await logEvent("info", "admin.report_status", `${r.id} -> ${status}`, admin.id);
  return json({ ok: true });
});
