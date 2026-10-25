import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth-helpers";
import { createSession, destroySession, publicUser, requireUser, revokeAllSessions } from "@/lib/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { planForUser } from "@/lib/plan-store";
import { deleteStoredFile } from "@/lib/storage";

export const GET = handle(async () => {
  const user = await requireUser();
  const plan = await planForUser(user);
  const [total, dynamic, hosted, downloads] = await Promise.all([
    db.qrCode.count({ where: { userId: user.id } }),
    db.qrCode.count({ where: { userId: user.id, isDynamic: true, isHosted: false } }),
    db.qrCode.count({ where: { userId: user.id, isHosted: true } }),
    db.download.count({ where: { userId: user.id } }),
  ]);
  return json({
    user: await publicUser(user),
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
  const body = await readJson(req, patchSchema, 10_000);
  if (body.newPassword) await rateLimit(`pwchange:${user.id}`, 5, 15 * 60 * 1000);
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
    await revokeAllSessions(updated.id); // every other device is signed out
    await createSession(updated, { kind: "user" }); // keep this device signed in
    await audit("auth.password_changed", { actor: { id: updated.id } });
  }
  return json({ user: await publicUser(updated) });
});

export const DELETE = handle(async (req) => {
  const user = await requireUser();
  const { confirm } = await readJson(req, z.object({ confirm: z.string() }));
  if (confirm.trim().toLowerCase() !== user.email) throw new ApiError(400, "Type your email address to confirm.");
  if (user.role === "super_admin") {
    const others = await db.user.count({ where: { role: "super_admin", status: "active", id: { not: user.id } } });
    if (others === 0) throw new ApiError(400, "You are the last super administrator. Promote another super administrator before deleting this account.");
  }
  const uploads = await db.upload.findMany({ where: { userId: user.id } });
  for (const u of uploads) await deleteStoredFile(u.storedName);
  await db.user.delete({ where: { id: user.id } });
  await audit("account.deleted", { actor: { id: user.id } });
  await destroySession("user");
  return json({ ok: true });
});
