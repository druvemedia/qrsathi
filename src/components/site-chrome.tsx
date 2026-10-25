"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./brand";
import { ThemeToggle, UserMenu } from "./user-menu";
import { useApp } from "./providers";
import { footerLine, socialLinks } from "@/lib/branding";
import { BrandIcon } from "./brand-icon";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/tools", label: "Tools" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { settings, user } = useApp();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      {settings.announcement && (
        <div className="border-b border-zinc-200 bg-white px-4 py-2 text-center text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" aria-hidden />{settings.announcement}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-[#fbfbf9]/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#0b0b0d]/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                  className={cn("rounded-md px-3 py-2 text-sm transition-colors", active ? "text-zinc-950 dark:text-white" : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white")}>
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/dashboard" className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white sm:inline-flex">Open app</Link>
                <UserMenu />
              </>
            ) : (
              <>
                <Link href="/login" className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white sm:inline-flex">Sign in</Link>
                <Link href="/signup" className="hidden h-9 items-center rounded-lg bg-zinc-950 px-3.5 text-sm font-medium text-white transition-[background-color,transform] hover:bg-zinc-800 active:scale-[0.98] dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:inline-flex">Get started</Link>
              </>
            )}
            <button className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-nav">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" className="origin-top animate-dropdown-in border-t border-zinc-200 px-4 pb-4 pt-2 dark:border-zinc-800 md:hidden" aria-label="Mobile">
            <ul className="space-y-0.5">
              {NAV.map((l) => <li key={l.href}><Link href={l.href} className="block rounded-lg px-3 py-2.5 text-[15px] hover:bg-zinc-100 dark:hover:bg-zinc-800">{l.label}</Link></li>)}
            </ul>
            {!user && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/login" className="flex h-10 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">Sign in</Link>
                <Link href="/signup" className="flex h-10 items-center justify-center rounded-lg bg-zinc-950 text-sm font-medium text-white dark:bg-white dark:text-zinc-950">Get started</Link>
              </div>
            )}
            {user && <Link href="/dashboard" className="mt-3 flex h-10 items-center justify-center rounded-lg bg-zinc-950 text-sm font-medium text-white dark:bg-white dark:text-zinc-950">Open app</Link>}
          </nav>
        )}
      </header>
    </>
  );
}

const COLS: { title: string; links: [string, string][] }[] = [
  { title: "Product", links: [["/features", "Features"], ["/pricing", "Pricing"], ["/help", "Help & FAQ"]] },
  { title: "Tools", links: [["/generator", "QR code generator"], ["/barcodes", "Barcode generator"], ["/scanner", "Scanner"], ["/upi", "UPI payment QR"], ["/bulk", "Bulk generator"]] },
  { title: "Company", links: [["/about", "About"], ["/contact", "Contact"], ["/report", "Report abuse"]] },
  { title: "Legal", links: [["/privacy", "Privacy"], ["/terms", "Terms"]] },
];

export function SiteFooter() {
  const { settings } = useApp();
  const b = settings.branding;
  const social = socialLinks(b);
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{b.shortDescription}</p>
          {(b.supportEmail || b.contactPhone) && (
            <ul className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {b.supportEmail && <li><a href={`mailto:${b.supportEmail}`} className="hover:text-zinc-950 dark:hover:text-white">{b.supportEmail}</a></li>}
              {b.contactPhone && <li><a href={`tel:${b.contactPhone.replace(/[^\d+]/g, "")}`} className="hover:text-zinc-950 dark:hover:text-white">{b.contactPhone}</a></li>}
            </ul>
          )}
          {social.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label={`${b.brandName} on social media`}>
              {social.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`${b.brandName} on ${l.label} (opens in a new tab)`}
                    className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 text-zinc-600 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white">
                    <BrandIcon brand={l.id} mono className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([href, label]) => (
                <li key={href}><Link href={href} className="text-sm text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-zinc-500 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>{footerLine(b)}</p>
          <p className="max-w-xl md:text-right">UPI is a registered trademark of NPCI. Payment-app names belong to their owners; {b.brandName} is not affiliated with them.</p>
        </div>
      </div>
    </footer>
  );
}
