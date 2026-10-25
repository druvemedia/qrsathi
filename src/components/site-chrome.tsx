"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./brand";
import { ThemeToggle, UserMenu } from "./user-menu";
import { useApp } from "./providers";

const LINKS = [
  { href: "/generator", label: "Generator" },
  { href: "/barcodes", label: "Barcodes" },
  { href: "/upi", label: "UPI QR" },
  { href: "/bulk", label: "Bulk" },
  { href: "/scanner", label: "Scanner" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { settings } = useApp();
  return (
    <>
      {settings.announcement && <div className="bg-brand px-4 py-2 text-center text-xs font-medium text-white">{settings.announcement}</div>}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/75">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <div className="hidden sm:block"><UserMenu /></div>
            <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 lg:hidden" aria-label="Mobile">
            <div className="grid grid-cols-2 gap-1">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-3 sm:hidden"><UserMenu /></div>
          </nav>
        )}
      </header>
    </>
  );
}

export function SiteFooter() {
  const { settings } = useApp();
  const cols = [
    { title: "Create", links: [["/generator", "QR Generator"], ["/barcodes", "Barcode Generator"], ["/upi", "UPI Payment QR"], ["/studio", "Design Studio"], ["/bulk", "Bulk Generator"], ["/scanner", "QR Scanner"]] },
    { title: "Manage", links: [["/dashboard", "Dashboard"], ["/products", "Products & Inventory"], ["/dynamic", "Dynamic QR"], ["/analytics", "Analytics"], ["/pricing", "Pricing"]] },
    { title: "Company", links: [["/help", "Help & FAQ"], ["/privacy", "Privacy Policy"], ["/terms", "Terms of Service"], ["/report", "Report abuse"]] },
  ];
  return (
    <footer className="mt-24 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">{settings.tagline}. Made for Indian businesses, creators and shops.</p>
          <p className="mt-4 text-xs text-slate-400">UPI is a registered trademark of NPCI. Google Pay, PhonePe, Paytm and BHIM are trademarks of their respective owners. {settings.siteName} is not affiliated with them.</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-400 dark:border-slate-800">
        © {new Date().getFullYear()} {settings.companyName}. All rights reserved.
      </div>
    </footer>
  );
}
