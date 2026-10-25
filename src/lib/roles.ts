/**
 * Authorization model. Roles are assigned only server-side (bootstrap CLI or a
 * super administrator) — never from signup forms or client requests.
 *
 *  user         ordinary account (default for every signup)
 *  admin        platform administration: users (suspend/reactivate/sessions),
 *               moderation, plans, reports, analytics, settings
 *  super_admin  everything an admin can do + role management + account deletion;
 *               must enable MFA before using the console
 */
export const ROLES = ["user", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const isAdminRole = (role: string | null | undefined) => role === "admin" || role === "super_admin";
export const isSuperAdmin = (role: string | null | undefined) => role === "super_admin";

export const ROLE_LABELS: Record<string, string> = { user: "User", admin: "Admin", super_admin: "Super admin" };
