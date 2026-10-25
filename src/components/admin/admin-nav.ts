import {
  BarChart3, Barcode, CreditCard, Flag, Gauge, KeyRound, Landmark, LayoutTemplate, Mail, Package, Palette, QrCode, Receipt,
  ScrollText, Server, Settings, ShieldAlert, Tags, UserCog, Users, type LucideIcon,
} from "lucide-react";

export interface AdminNavItem { href: string; label: string; icon: LucideIcon }
export interface AdminNavGroup { label: string; items: AdminNavItem[] }

/** Admin-console navigation. Completely separate from the user workspace nav. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/admin", label: "Overview", icon: Gauge },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/qr-codes", label: "QR codes", icon: QrCode },
      { href: "/admin/barcodes", label: "Barcodes", icon: Barcode },
      { href: "/admin/products", label: "Products & inventory", icon: Package },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/reports", label: "Abuse reports", icon: Flag },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/admin/settings/pricing", label: "Plans & pricing", icon: Tags },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { href: "/admin/payments", label: "Payments", icon: Receipt },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/admin/settings/branding", label: "Website branding", icon: LayoutTemplate },
      { href: "/admin/settings/appearance", label: "Appearance", icon: Palette },
      { href: "/admin/settings/payments", label: "Payment gateway", icon: Landmark },
      { href: "/admin/settings/email", label: "Email", icon: Mail },
      { href: "/admin/settings", label: "General settings", icon: Settings },
    ],
  },
  {
    label: "Security",
    items: [
      { href: "/admin/security/events", label: "Security events", icon: ShieldAlert },
      { href: "/admin/security/admins", label: "Administrators", icon: UserCog },
      { href: "/admin/security", label: "Audit log", icon: ScrollText },
      { href: "/admin/system", label: "System health", icon: Server },
    ],
  },
  { label: "My account", items: [{ href: "/admin/mfa", label: "Two-factor auth", icon: KeyRound }] },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV.flatMap((g) => g.items);

export function adminGroupOf(href: string) {
  return ADMIN_NAV.find((g) => g.items.some((i) => i.href === href))?.label;
}

export function activeAdminItem(pathname: string) {
  return ADMIN_NAV_ITEMS.filter((i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
