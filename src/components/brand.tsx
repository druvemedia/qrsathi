"use client";
import Link from "next/link";
import { useApp } from "./providers";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid h-8 w-8 place-items-center rounded-xl bg-brand-gradient text-white shadow-md shadow-brand/30", className)}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
        <path d="M3 3h7v7H3zm2 2v3h3V5zm9-2h7v7h-7zm2 2v3h3V5zM3 14h7v7H3zm2 2v3h3v-3zm9-2h3v3h-3zm4 0h3v3h-3zm-4 4h3v3h-3zm4 0h3v3h-3z" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  const { settings } = useApp();
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight", className)}>
      <LogoMark />
      <span>{settings.siteName}</span>
    </Link>
  );
}
