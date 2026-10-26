"use client";
/**
 * Application frame: collapsible desktop sidebar (AppSidebar), mobile drawer
 * (MobileNavigation), top bar with breadcrumbs and the quick-action launcher.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";
import { BrandMark, LogoMark } from "./brand";
import { ThemeToggle, UserMenu } from "./user-menu";
import { useApp } from "./providers";
import { CommandPalette } from "./command-palette";
import { NAV, activeItem, breadcrumbsFor } from "./nav-config";
import { Breadcrumbs, Kbd, Tooltip } from "./ui";
import { cn } from "@/lib/utils";

// v2: earlier builds hid the expand control at the bottom of the rail, so a stale
// "collapsed" preference is ignored and every browser starts expanded again.
const COLLAPSE_KEY = "qrsathi:sidebar-collapsed:v2";

function useIsActive() {
  const pathname = usePathname();
  const current = activeItem(pathname);
  return (href: string) => current?.href === href;
}

function NavLinks({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const isActive = useIsActive();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // Open "More tools" automatically when one of its pages is active.
  useEffect(() => {
    if (NAV.find((g) => g.secondary)?.items.some((i) => isActive(i.href))) setMoreOpen(true);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav className="flex flex-col gap-5" aria-label="Main">
      {NAV.map((g) => {
        const items = g.items;
        const hidden = g.secondary && !moreOpen && !collapsed;
        return (
          <div key={g.id}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-slate-200 dark:bg-slate-800" aria-hidden />
            ) : g.secondary ? (
              <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}
                className="mb-1 flex w-full items-center justify-between px-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                {g.label}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} aria-hidden />
              </button>
            ) : (
              <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.label}</p>
            )}
            {!hidden && (
              <ul className="space-y-0.5">
                {items.map((i) => {
                  const active = isActive(i.href);
                  return (
                    <li key={i.href}>
                      <Tooltip label={i.label} disabled={!collapsed}>
                        <Link
                          href={i.href}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          aria-label={collapsed ? i.label : undefined}
                          className={cn(
                            "group relative flex items-center gap-2.5 rounded-xl text-sm transition-colors duration-150",
                            collapsed ? "h-9 w-9 justify-center" : "px-2.5 py-[7px]",
                            active
                              ? "bg-white font-medium text-slate-900 shadow-card ring-1 ring-slate-200/80 before:absolute before:-left-3 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-brand dark:bg-slate-800/80 dark:text-white dark:ring-slate-700"
                              : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white",
                          )}
                        >
                          <i.icon className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300")} aria-hidden />
                          {!collapsed && <span className="truncate">{i.label}</span>}
                        </Link>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  const { settings } = useApp();
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 font-semibold tracking-tight", collapsed && "justify-center")} aria-label={`${settings.siteName} home`}>
      {collapsed ? <LogoMark className="h-7 w-7" /> : <BrandMark />}
    </Link>
  );
}

function GuestCard() {
  const { user } = useApp();
  if (user) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium">Save your work</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Free account: saved codes, dynamic QR, products and analytics.</p>
      <Link href="/signup" className="mt-3 inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-medium text-white hover:bg-brand/90">Create free account</Link>
    </div>
  );
}

function CreateButton({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <Tooltip label="Create QR code" disabled={!collapsed}>
      <Link href="/generator" onClick={onNavigate} aria-label={collapsed ? "Create QR code" : undefined}
        className={cn("mb-5 flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 active:scale-[.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100",
          collapsed ? "h-9 w-9" : "h-10 w-full")}>
        <Plus className="h-4 w-4" aria-hidden />{!collapsed && "Create QR code"}
      </Link>
    </Tooltip>
  );
}

function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = collapsed ? "Expand sidebar (show names)" : "Collapse sidebar";
  return (
    <Tooltip label={label} side="right">
      <button onClick={onToggle} aria-label={label} aria-expanded={!collapsed}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>
    </Tooltip>
  );
}

/** Desktop sidebar, collapsible to an icon rail (state remembered on this device). The toggle sits at the top so it's always visible. */
function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-950 lg:flex", collapsed ? "w-[68px]" : "w-60")}>
      <div className={cn("flex h-14 shrink-0 items-center border-b border-slate-200/70 dark:border-slate-800/80", collapsed ? "justify-center" : "justify-between pl-4 pr-2")}>
        {collapsed ? <SidebarToggle collapsed onToggle={onToggle} /> : <><SidebarBrand collapsed={false} /><SidebarToggle collapsed={false} onToggle={onToggle} /></>}
      </div>
      <div className={cn("flex-1 overflow-y-auto pb-4 pt-3 scrollbar-thin", collapsed ? "px-3.5" : "px-3")}>
        <CreateButton collapsed={collapsed} />
        <NavLinks collapsed={collapsed} />
      </div>
      {!collapsed && <div className="border-t border-slate-200 p-3 empty:hidden dark:border-slate-800"><GuestCard /></div>}
    </aside>
  );
}

/** Mobile/tablet drawer with focus management and Escape to close. */
function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => panel.current?.querySelector<HTMLElement>("a,button")?.focus(), 30);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panel} className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col bg-slate-50 shadow-pop dark:bg-slate-950">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <SidebarBrand collapsed={false} />
          <button className="rounded-lg p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3"><CreateButton onNavigate={onClose} /><NavLinks onNavigate={onClose} /></div>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800"><GuestCard /></div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch {}
      return !c;
    });
  }, []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const crumbs = breadcrumbsFor(pathname);

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop">Skip to content</a>
      <AppSidebar collapsed={collapsed} onToggle={toggle} />
      <MobileNavigation open={mobileOpen} onClose={closeMobile} />
      <div className="flex min-w-0 flex-1 flex-col">
        {settings.announcement && <div className="bg-brand px-4 py-1.5 text-center text-xs font-medium text-white">{settings.announcement}</div>}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200/70 bg-slate-50/80 px-3 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80 sm:px-5">
          <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden"><SidebarBrand collapsed /></div>
          <div className="hidden min-w-0 md:block [&_nav]:mb-0"><Breadcrumbs items={crumbs} /></div>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setPaletteOpen(true)} className="hidden h-8 w-56 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-400 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 sm:flex" aria-label="Open quick actions (Ctrl+K)">
              <Search className="h-3.5 w-3.5" aria-hidden /><span className="flex-1 text-left">Search or jump to…</span><Kbd>Ctrl K</Kbd>
            </button>
            <button onClick={() => setPaletteOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:hidden" aria-label="Search">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div key={pathname} className="mx-auto max-w-7xl animate-page-in">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
