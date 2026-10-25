import {
  BarChart3, CreditCard, Flag, Gauge, KeyRound, Package, QrCode, Receipt, Server, Settings, ShieldCheck, Users, type LucideIcon,
} from "lucide-react";

export interface AdminNavItem { href: string; label: string; icon: LucideIcon; superAdmin?: boolean }
export interface AdminNavGroup { label: string; items: AdminNavItem[] }

/** Admin-console navigation. Completely separate from the user workspace nav. */
export const ADMIN_NAV: AdminNavGroup[] = [
  { label: "Console", items: [{ href: "/admin", label: "Overview", icon: Gauge }] },
  {
    label: "Platform",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/qr-codes", label: "QR codes", icon: QrCode },
      { href: "/admin/reports", label: "Abuse reports", icon: Flag },
      { href: "/admin/products", label: "Products & inventory", icon: Package },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { href: "/admin/payments", label: "Payments", icon: Receipt },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/security", label: "Security & audit", icon: ShieldCheck },
      { href: "/admin/settings", label: "Site settings", icon: Settings },
      { href: "/admin/system", label: "System", icon: Server },
    ],
  },
  { label: "My account", items: [{ href: "/admin/mfa", label: "Two-factor auth", icon: KeyRound }] },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV.flatMap((g) => g.items);

export function activeAdminItem(pathname: string) {
  return ADMIN_NAV_ITEMS.filter((i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
