import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { logEvent } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  plan: z.enum(["free", "pro", "business"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await readJson(req, schema);
  if (id === admin.id && (body.role === "user" || body.status === "suspended"))
    throw new ApiError(400, "You can't demote or suspend your own account.");
  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new ApiError(404, "User not found.");
  const data: Record<string, unknown> = { ...body };
  if (body.plan) data.planExpiresAt = null; // admin-assigned plans don't lapse
  if (body.status === "suspended") data.sessionVersion = { increment: 1 }; // sign them out everywhere
  const user = await db.user.update({ where: { id }, data });
  await logEvent("info", "admin.user_updated", `${user.email}: ${JSON.stringify(body)}`, admin.id);
  return json({ ok: true });
});

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  if (id === admin.id) throw new ApiError(400, "You can't delete your own account here.");
  const user = await db.user.delete({ where: { id } }).catch(() => null);
  if (!user) throw new ApiError(404, "User not found.");
  await logEvent("warn", "admin.user_deleted", user.email, admin.id);
  return json({ ok: true });
});
