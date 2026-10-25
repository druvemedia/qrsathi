"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { History, LayoutDashboard, LogOut, Moon, Settings, Shield, Sun } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "./providers";
import { LinkButton } from "./ui";

export function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  return (
    <button
      onClick={toggleTheme}
      className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

export function UserMenu() {
  const { user, setUser } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!user)
    return (
      <div className="flex items-center gap-2">
        <LinkButton href="/login" variant="ghost" size="sm" className="h-9">Log in</LinkButton>
        <LinkButton href="/signup" size="sm" className="h-9">Sign up free</LinkButton>
      </div>
    );

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  };
  const initials = (user.name || user.email).split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-xs font-bold text-white">{initials}</span>
        <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">{user.name || user.email}</span>
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-12 z-50 w-60 animate-scale-in p-1.5 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand">{user.planName} plan</p>
          </div>
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          {[
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/dashboard/history", label: "Download history", icon: History },
            { href: "/dashboard/settings", label: "Account settings", icon: Settings },
            ...(user.role === "admin" ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
          ].map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)} role="menuitem" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              <i.icon className="h-4 w-4 text-slate-500" />
              {i.label}
            </Link>
          ))}
          <button onClick={logout} role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
