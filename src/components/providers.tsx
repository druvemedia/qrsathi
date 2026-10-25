"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Toaster } from "sonner";
import type { PublicUser } from "@/lib/session";
import type { SiteSettings } from "@/lib/brand";

export type ThemePref = "light" | "dark" | "system";

interface AppCtx {
  user: PublicUser | null;
  setUser: (u: PublicUser | null) => void;
  refreshUser: () => Promise<void>;
  settings: SiteSettings;
  /** Resolved theme currently shown. */
  theme: "light" | "dark";
  /** User preference (System follows the OS setting). */
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

function readPref(): ThemePref {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function Providers({ children, user: initial, settings }: { children: React.ReactNode; user: PublicUser | null; settings: SiteSettings }) {
  const [user, setUser] = useState(initial);
  const [themePref, setPref] = useState<ThemePref>("system");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Apply the preference and keep "system" in sync with the OS.
  useEffect(() => {
    setPref(readPref());
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = themePref === "dark" || (themePref === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      setTheme(dark ? "dark" : "light");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [themePref]);

  const setThemePref = useCallback((t: ThemePref) => {
    setPref(t);
    try {
      if (t === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch {}
  }, []);
  const toggleTheme = useCallback(() => setThemePref(theme === "dark" ? "light" : "dark"), [theme, setThemePref]);

  const refreshUser = useCallback(async () => {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const j = await r.json().catch(() => ({ user: null }));
    setUser(j.user);
  }, []);

  return (
    <Ctx.Provider value={{ user, setUser, refreshUser, settings, theme, themePref, setThemePref, toggleTheme }}>
      {children}
      <Toaster position="bottom-right" theme={theme} closeButton richColors
        toastOptions={{ className: "!rounded-lg !text-sm !shadow-pop", duration: 4000 }} />
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside <Providers>");
  return c;
}
