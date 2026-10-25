/**
 * Permission rules for administrator actions on user accounts.
 *  - admins may act on ordinary users only
 *  - super admins may act on anyone except themselves (for destructive changes)
 *  - the last active super admin can never be demoted, suspended or deleted
 */
import type { User } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { isAdminRole, isSuperAdmin } from "./roles";

export async function assertCanManage(actor: User, target: User, action: "status" | "plan" | "role" | "delete" | "sessions" | "reset") {
  if (actor.id === target.id && ["status", "role", "delete"].includes(action))
    throw new ApiError(400, "You can't change your own status, role or delete your own account here.");
  if (isAdminRole(target.role) && !isSuperAdmin(actor.role))
    throw new ApiError(403, "Only a super administrator can manage administrator accounts.");
  if ((action === "role" || action === "delete") && !isSuperAdmin(actor.role))
    throw new ApiError(403, "Only a super administrator can change roles or delete accounts.");
}

/** Throws if the change would leave the platform without an active super admin. */
export async function assertNotLastSuperAdmin(target: User, change: { role?: string; status?: string; delete?: boolean }) {
  if (!isSuperAdmin(target.role) || target.status !== "active") return;
  const loses = change.delete || (change.role && change.role !== "super_admin") || (change.status && change.status !== "active");
  if (!loses) return;
  const others = await db.user.count({ where: { role: "super_admin", status: "active", id: { not: target.id } } });
  if (others === 0) throw new ApiError(400, "This is the last active super administrator. Promote another super administrator first.");
}
