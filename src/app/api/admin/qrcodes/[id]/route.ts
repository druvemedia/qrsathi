import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { status } = await readJson(req, z.object({ status: z.enum(["active", "paused", "disabled"]) }), 10_000);
  const before = await db.qrCode.findUnique({ where: { id }, select: { status: true, shortCode: true } });
  if (!before) throw new ApiError(404, "QR code not found.");
  await db.qrCode.update({ where: { id }, data: { status } });
  await audit("admin.qr.status_changed", { actor: admin, targetType: "qr", targetId: id, ip: clientIp(req), details: { shortCode: before.shortCode, from: before.status, to: status } });
  return json({ ok: true });
});

export const DELETE = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const qr = await db.qrCode.delete({ where: { id } }).catch(() => null);
  if (!qr) throw new ApiError(404, "QR code not found.");
  await audit("admin.qr.deleted", { actor: admin, targetType: "qr", targetId: id, ip: clientIp(req), details: { shortCode: qr.shortCode } });
  return json({ ok: true });
});
