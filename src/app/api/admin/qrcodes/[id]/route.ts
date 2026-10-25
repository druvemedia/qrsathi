import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { logEvent } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { status } = await readJson(req, z.object({ status: z.enum(["active", "paused", "disabled"]) }));
  const qr = await db.qrCode.update({ where: { id }, data: { status } }).catch(() => null);
  if (!qr) throw new ApiError(404, "QR code not found.");
  await logEvent("info", "admin.qr_status", `${qr.shortCode} -> ${status}`, admin.id);
  return json({ ok: true });
});

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const qr = await db.qrCode.delete({ where: { id } }).catch(() => null);
  if (!qr) throw new ApiError(404, "QR code not found.");
  await logEvent("warn", "admin.qr_deleted", `${qr.shortCode} ${qr.name}`, admin.id);
  return json({ ok: true });
});
