"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Barcode, BarChart3, CircleHelp, CreditCard, FileSpreadsheet, History, Home, IndianRupee, LayoutDashboard, Menu, Package, Palette, QrCode,
  RefreshCw, ScanLine, Settings, Shield, Warehouse, X,
} from "lucide-react";
import { Logo } from "./brand";
import { ThemeToggle, UserMenu } from "./user-menu";
import { useApp } from "./providers";
import { cn } from "@/lib/utils";

const NAV = [
  {
    section: "Create",
    items: [
      { href: "/generator", label: "QR Generator", icon: QrCode },
      { href: "/barcodes", label: "Barcode Generator", icon: Barcode },
      { href: "/upi", label: "UPI Payment QR", icon: IndianRupee },
      { href: "/studio", label: "Design Studio", icon: Palette },
      { href: "/bulk", label: "Bulk Generator", icon: FileSpreadsheet },
    ],
  },
  {
    section: "Scan",
    items: [
      { href: "/scanner", label: "Universal Scanner", icon: ScanLine },
      { href: "/scan-history", label: "Scan History", icon: History },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/products", label: "Products", icon: Package },
      { href: "/inventory", label: "Inventory", icon: Warehouse },
      { href: "/dynamic", label: "Dynamic QR", icon: RefreshCw },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    section: "More",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/pricing", label: "Pricing", icon: CreditCard },
      { href: "/help", label: "Help & FAQ", icon: CircleHelp },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, settings } = useApp();

  useEffect(() => setOpen(false), [pathname]);

  const nav = user?.role === "admin" ? [...NAV, { section: "Admin", items: [{ href: "/admin", label: "Admin panel", icon: Shield }] }] : NAV;
  const isActive = (href: string) =>
    href === "/" || href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5 scrollbar-thin" aria-label="Main">
      {nav.map((g) => (
        <div key={g.section}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.section}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={isActive(i.href) ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    isActive(i.href)
                      ? "bg-brand/10 text-brand dark:bg-brand/15"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white",
                  )}
                >
                  <i.icon className={cn("h-[18px] w-[18px]", isActive(i.href) ? "text-brand" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200")} />
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!user && (
        <div className="mt-auto rounded-2xl bg-brand-gradient p-4 text-white">
          <p className="font-display font-bold">Save & track your QRs</p>
          <p className="mt-1 text-xs text-white/85">Free account: dynamic QR codes, analytics and a saved library.</p>
          <Link href="/signup" className="mt-3 inline-block rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900">Create free account</Link>
        </div>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen">
      {settings.announcement && (
        <div className="bg-brand-gradient px-4 py-2 text-center text-xs font-medium text-white">{settings.announcement}</div>
      )}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80 lg:pl-0">
        <div className="flex items-center gap-2 lg:w-64 lg:px-6">
          <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-slate-200/80 bg-white/50 dark:border-slate-800 dark:bg-slate-950/50 lg:block">
          {sidebar}
        </aside>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 animate-fade-up bg-white shadow-2xl dark:bg-slate-950">
              <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
                <Logo />
                <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="h-[calc(100%-4rem)]">{sidebar}</div>
            </aside>
          </div>
        )}
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
