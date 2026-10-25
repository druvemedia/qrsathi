"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Toaster } from "sonner";
import type { PublicUser } from "@/lib/session";
import type { SiteSettings } from "@/lib/brand";

interface AppCtx {
  user: PublicUser | null;
  setUser: (u: PublicUser | null) => void;
  refreshUser: () => Promise<void>;
  settings: SiteSettings;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function Providers({ children, user: initial, settings }: { children: React.ReactNode; user: PublicUser | null; settings: SiteSettings }) {
  const [user, setUser] = useState(initial);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("theme", next);
      } catch {}
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const j = await r.json().catch(() => ({ user: null }));
    setUser(j.user);
  }, []);

  return (
    <Ctx.Provider value={{ user, setUser, refreshUser, settings, theme, toggleTheme }}>
      {children}
      <Toaster richColors position="top-center" theme={theme} closeButton />
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside <Providers>");
  return c;
}
