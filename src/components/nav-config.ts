import {
  BarChart3, Barcode, CircleHelp, CreditCard, FileSpreadsheet, History, IndianRupee, LayoutDashboard, Library, Package, Palette,
  QrCode, RefreshCw, ScanLine, Settings, Warehouse, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short hint used by the quick-action launcher. */
  keywords?: string;
}
export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  /** Secondary groups start collapsed in the sidebar. */
  secondary?: boolean;
}

export const NAV: NavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, keywords: "home dashboard" },
      { href: "/generator", label: "QR Generator", icon: QrCode, keywords: "create qr code url wifi whatsapp" },
      { href: "/barcodes", label: "Barcode Generator", icon: Barcode, keywords: "ean upc code128 label" },
      { href: "/scanner", label: "Universal Scanner", icon: ScanLine, keywords: "scan camera read" },
      { href: "/scan-history", label: "Scan History", icon: History, keywords: "scans log" },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      { href: "/products", label: "Products", icon: Package, keywords: "catalogue sku items" },
      { href: "/inventory", label: "Inventory", icon: Warehouse, keywords: "stock in out low stock" },
      { href: "/bulk", label: "Bulk Generator", icon: FileSpreadsheet, keywords: "csv excel import batch" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, keywords: "scans stats charts" },
    ],
  },
  {
    id: "tools",
    label: "More tools",
    secondary: true,
    items: [
      { href: "/codes", label: "My QR Codes", icon: Library, keywords: "saved library" },
      { href: "/dynamic", label: "Dynamic QR", icon: RefreshCw, keywords: "short link redirect edit" },
      { href: "/upi", label: "UPI Payment QR", icon: IndianRupee, keywords: "gpay phonepe paytm payment standee" },
      { href: "/studio", label: "Design Studio", icon: Palette, keywords: "customise colours logo frame" },
      { href: "/pricing", label: "Plans & Pricing", icon: CreditCard, keywords: "upgrade billing" },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings, keywords: "profile password theme" },
      { href: "/help", label: "Help & Support", icon: CircleHelp, keywords: "faq support" },
    ],
  },
];

const ALL = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

/** Most specific nav item for a pathname. */
export function activeItem(pathname: string) {
  const exact = ALL.find((i) => i.href === pathname);
  if (exact) return exact;
  return ALL.filter((i) => i.href !== "/dashboard" && pathname.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
}

const EXTRA_CRUMBS: Record<string, string> = { new: "New", history: "Download history" };

/** Breadcrumb trail for the top bar, e.g. Business › Products › New. */
export function breadcrumbsFor(pathname: string): { label: string; href?: string }[] {
  const item = activeItem(pathname);
  if (!item) return [];
  const crumbs: { label: string; href?: string }[] = [{ label: item.group }, { label: item.label, href: item.href }];
  const rest = pathname.slice(item.href.length).split("/").filter(Boolean);
  if (rest.length) crumbs.push({ label: EXTRA_CRUMBS[rest[0]] || "Details" });
  return crumbs;
}

export { ALL as NAV_ITEMS };
