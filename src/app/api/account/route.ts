import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth-helpers";
import { createSession, destroySession, publicUser, requireUser } from "@/lib/session";
import { getPlan } from "@/lib/plans";
import { logEvent } from "@/lib/log";
import { deleteStoredFile } from "@/lib/storage";

export const GET = handle(async () => {
  const user = await requireUser();
  const plan = getPlan(user.plan);
  const [total, dynamic, hosted, downloads] = await Promise.all([
    db.qrCode.count({ where: { userId: user.id } }),
    db.qrCode.count({ where: { userId: user.id, isDynamic: true, isHosted: false } }),
    db.qrCode.count({ where: { userId: user.id, isHosted: true } }),
    db.download.count({ where: { userId: user.id } }),
  ]);
  return json({
    user: publicUser(user),
    plan,
    usage: { saved: total, dynamic, hosted, downloads },
  });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: passwordSchema.optional(),
});

export const PATCH = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, patchSchema);
  const data: Record<string, unknown> = {};
  if (body.name) data.name = body.name;
  if (body.newPassword) {
    if (user.passwordHash) {
      if (!body.currentPassword || !(await verifyPassword(body.currentPassword, user.passwordHash)))
        throw new ApiError(400, "Current password is incorrect.");
    }
    data.passwordHash = await hashPassword(body.newPassword);
    data.sessionVersion = { increment: 1 };
  }
  const updated = await db.user.update({ where: { id: user.id }, data });
  if (body.newPassword) {
    await createSession(updated); // keep this device signed in
    await logEvent("info", "auth.password_changed", updated.email, updated.id);
  }
  return json({ user: publicUser(updated) });
});

export const DELETE = handle(async (req) => {
  const user = await requireUser();
  const { confirm } = await readJson(req, z.object({ confirm: z.string() }));
  if (confirm.trim().toLowerCase() !== user.email) throw new ApiError(400, "Type your email address to confirm.");
  const uploads = await db.upload.findMany({ where: { userId: user.id } });
  for (const u of uploads) await deleteStoredFile(u.storedName);
  await db.user.delete({ where: { id: user.id } });
  await logEvent("info", "account.deleted", user.email);
  await destroySession();
  return json({ ok: true });
});
