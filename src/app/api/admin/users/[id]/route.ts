import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin, revokeAllSessions } from "@/lib/session";
import { assertCanManage, assertNotLastSuperAdmin } from "@/lib/admin-users";
import { sendPasswordReset } from "@/lib/password-reset";
import { deleteStoredFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  role: z.enum(["user", "admin", "super_admin"]).optional(),
  plan: z.enum(["free", "pro", "business"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

async function target(id: string) {
  const u = await db.user.findUnique({ where: { id } });
  if (!u) throw new ApiError(404, "User not found.");
  return u;
}

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await readJson(req, patchSchema, 10_000);
  const user = await target(id);
  if (body.role !== undefined) await assertCanManage(admin, user, "role");
  if (body.status !== undefined) await assertCanManage(admin, user, "status");
  if (body.plan !== undefined) await assertCanManage(admin, user, "plan");
  await assertNotLastSuperAdmin(user, body);
  const data: Record<string, unknown> = { ...body };
  if (body.plan) data.planExpiresAt = null; // admin-assigned plans don't lapse
  const roleChanged = body.role !== undefined && body.role !== user.role;
  const suspended = body.status === "suspended" && user.status !== "suspended";
  // Suspension or role change invalidates every session (incl. admin console).
  if (suspended || roleChanged) data.sessionVersion = { increment: 1 };
  if (roleChanged && body.role === "user") Object.assign(data, { mfaEnabledAt: null, mfaSecret: null, mfaLastStep: 0 });
  const updated = await db.user.update({ where: { id }, data });
  if (suspended || roleChanged) await revokeAllSessions(id);
  await audit(roleChanged ? "admin.user.role_changed" : suspended ? "admin.user.suspended" : body.status === "active" ? "admin.user.reactivated" : "admin.user.updated", {
    actor: admin, targetType: "user", targetId: id, ip: clientIp(req),
    details: { from: { role: user.role, plan: user.plan, status: user.status }, to: body },
  });
  return json({ ok: true, user: { id: updated.id, role: updated.role, plan: updated.plan, status: updated.status } });
});

const actionSchema = z.object({ action: z.enum(["revoke_sessions", "send_password_reset"]) });

/** Account-recovery actions. Admins never see or set a user's password. */
export const POST = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { action } = await readJson(req, actionSchema, 10_000);
  const user = await target(id);
  if (action === "revoke_sessions") {
    await assertCanManage(admin, user, "sessions");
    await db.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });
    await revokeAllSessions(id);
    await audit("admin.user.sessions_revoked", { actor: admin, targetType: "user", targetId: id, ip: clientIp(req) });
    return json({ ok: true, message: "All sessions for this account were signed out." });
  }
  await assertCanManage(admin, user, "reset");
  if (user.status !== "active") throw new ApiError(400, "Reactivate the account before sending a reset link.");
  const sent = await sendPasswordReset(user, req);
  await audit("admin.user.password_reset_sent", { actor: admin, targetType: "user", targetId: id, ip: clientIp(req), details: { delivered: sent } });
  return json({ ok: true, delivered: sent, message: sent ? "A password-reset link was e-mailed to the user." : "Reset link created, but the e-mail couldn't be sent (SMTP isn't configured or delivery failed — see System → Application log). Nothing was delivered to the user." });
});

export const DELETE = handle<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin({ superAdmin: true });
  const { id } = await params;
  const user = await target(id);
  await assertCanManage(admin, user, "delete");
  await assertNotLastSuperAdmin(user, { delete: true });
  const uploads = await db.upload.findMany({ where: { userId: id }, select: { storedName: true } });
  await db.user.delete({ where: { id } });
  for (const u of uploads) await deleteStoredFile(u.storedName);
  await audit("admin.user.deleted", { actor: admin, targetType: "user", targetId: id, ip: clientIp(req), details: { email: user.email } });
  return json({ ok: true });
});
