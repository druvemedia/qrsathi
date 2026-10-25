"use client";
/**
 * Admin-console frame. Deliberately distinct from the user workspace
 * (AppShell): its own sidebar, header, account menu and colour cue, and no
 * workspace navigation.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, ExternalLink, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand";
import { ThemeToggle } from "@/components/user-menu";
import { useApp } from "@/components/providers";
import { Badge, Tooltip } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, activeAdminItem, adminGroupOf } from "./admin-nav";

const COLLAPSE_KEY = "qrsathi:admin-sidebar-collapsed";

export interface ConsoleAdmin { email: string; name: string; role: string; mfaEnabled: boolean }

function Nav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const current = activeAdminItem(pathname);
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {ADMIN_NAV.map((g) => (
        <div key={g.label}>
          {collapsed
            ? <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
            : <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = current?.href === i.href;
              return (
                <li key={i.href}>
                  <Tooltip label={i.label} disabled={!collapsed}>
                    <Link href={i.href} onClick={onNavigate} aria-current={active ? "page" : undefined} aria-label={collapsed ? i.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-xl text-sm transition-colors duration-150",
                        collapsed ? "mx-auto h-9 w-9 justify-center" : "px-2.5 py-[7px]",
                        active
                          ? "bg-white/[0.09] font-medium text-white before:absolute before:-left-3 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-amber-400"
                          : "text-zinc-400 hover:bg-white/[0.05] hover:text-white",
                      )}>
                      <i.icon className={cn("h-4 w-4 shrink-0", active ? "text-amber-300" : "text-zinc-500 group-hover:text-zinc-300")} aria-hidden />
                      {!collapsed && <span className="truncate">{i.label}</span>}
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { settings } = useApp();
  return (
    <>
      <Link href="/admin" onClick={onNavigate} className={cn("flex items-center gap-2.5", collapsed ? "justify-center" : "px-2.5")} aria-label={collapsed ? `${settings.siteName} admin console` : undefined}>
        <LogoMark className="h-7 w-7" />
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{settings.siteName}</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400">Admin console</span>
          </span>
        )}
      </Link>
      <div className="mt-6 min-h-0 flex-1 overflow-y-auto scrollbar-thin"><Nav onNavigate={onNavigate} collapsed={collapsed} /></div>
    </>
  );
}

function AccountMenu({ admin }: { admin: ConsoleAdmin }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => {});
    toast.success("Signed out of the admin console");
    router.replace("/admin/login");
    router.refresh();
  };
  const initials = (admin.name || admin.email).split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">{initials}</span>
        <span className="hidden max-w-[160px] truncate text-sm font-medium sm:block">{admin.email}</span>
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-11 z-50 w-64 origin-top-right animate-dropdown-in p-1.5 shadow-pop">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{admin.name || admin.email}</p>
            <p className="truncate text-xs text-slate-500">{admin.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Badge tone="amber">{ROLE_LABELS[admin.role] || admin.role}</Badge>
              {admin.mfaEnabled ? <Badge tone="green">2FA on</Badge> : <Badge tone="rose">2FA off</Badge>}
            </div>
          </div>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <Link href="/admin/mfa" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
            <KeyRound className="h-4 w-4 text-slate-500" /> Two-factor authentication
          </Link>
          <Link href="/" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
            <ExternalLink className="h-4 w-4 text-slate-500" /> View public site
          </Link>
          <button onClick={logout} role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <LogOut className="h-4 w-4" /> Sign out of admin
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminShell({ admin, children }: { admin: ConsoleAdmin; children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const current = activeAdminItem(pathname);
  const group = current && current.href !== "/admin" ? adminGroupOf(current.href) : undefined;
  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch {} }, []);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch {} return !c; });
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [drawer]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop">Skip to content</a>
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col bg-zinc-950 py-4 [color-scheme:dark] transition-[width] duration-200 lg:flex", collapsed ? "w-[68px] px-2" : "w-60 px-3")}>
        <SidebarBody collapsed={collapsed} />
        <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} side={collapsed ? "right" : "top"}>
          <button onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}
            className={cn("mt-3 flex items-center gap-2 rounded-xl text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-white", collapsed ? "mx-auto h-9 w-9 justify-center" : "w-full px-2.5 py-2")}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <><PanelLeftClose className="h-4 w-4" aria-hidden /> Collapse</>}
          </button>
        </Tooltip>
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col bg-zinc-950 px-3 py-4 [color-scheme:dark]">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-4 rounded-md p-1 text-slate-400 hover:text-white" aria-label="Close navigation"><X className="h-5 w-5" /></button>
            <SidebarBody onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-60")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200/70 bg-slate-50/85 px-4 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85 sm:px-6">
          <button onClick={() => setDrawer(true)} className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 sm:inline-flex">
              <ShieldCheck className="h-3 w-3" aria-hidden /> Admin
            </span>
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-1 text-sm">
                {group && (
                  <li className="hidden items-center gap-1 text-slate-500 md:flex">{group}<ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" aria-hidden /></li>
                )}
                <li className="truncate font-medium text-slate-800 dark:text-slate-100" aria-current="page">{current?.label || "Admin console"}</li>
              </ol>
            </nav>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu admin={admin} />
          </div>
        </header>
        {!admin.mfaEnabled && pathname !== "/admin/mfa" && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 sm:px-6">
            <ShieldAlert className="mr-1.5 inline h-4 w-4 align-[-3px]" aria-hidden />
            Two-factor authentication is not enabled on your administrator account. <Link href="/admin/mfa" className="font-medium underline">Set it up now</Link>.
          </div>
        )}
        <main id="admin-main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8"><div key={pathname} className="animate-page-in">{children}</div></main>
      </div>
    </div>
  );
}
