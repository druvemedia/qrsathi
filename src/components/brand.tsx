"use client";
/* eslint-disable @next/next/no-img-element -- uploaded brand assets are served as-is from /brand */
import Link from "next/link";
import { useApp } from "./providers";
import { assetUrl } from "@/lib/branding";
import { cn } from "@/lib/utils";

/** Built-in mark used when no logo has been uploaded. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-fg shadow-sm", className)}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
        <path d="M3 3h7v7H3zm2 2v3h3V5zm9-2h7v7h-7zm2 2v3h3V5zM3 14h7v7H3zm2 2v3h3v-3zm9-2h3v3h-3zm4 0h3v3h-3zm-4 4h3v3h-3zm4 0h3v3h-3z" />
      </svg>
    </span>
  );
}

/** Uploaded logo (light/dark variants) or the built-in mark, per Appearance → “Header shows”. */
export function BrandMark({ className, forceName }: { className?: string; forceName?: boolean }) {
  const { settings } = useApp();
  const b = settings.branding;
  const light = assetUrl(b.logo), dark = assetUrl(b.logoDark) ?? light;
  const showLogo = b.headerDisplay !== "name";
  const showName = forceName || b.headerDisplay !== "logo" || !light;
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {showLogo && (light ? (
        <>
          <img src={light} alt={showName ? "" : b.brandName} className="h-7 w-auto max-w-[160px] object-contain dark:hidden" />
          <img src={dark!} alt={showName ? "" : b.brandName} className="hidden h-7 w-auto max-w-[160px] object-contain dark:block" />
        </>
      ) : <LogoMark />)}
      {showName && <span className="text-[15px] font-semibold tracking-tight">{b.brandName}</span>}
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("rounded-md", className)} aria-label="Home">
      <BrandMark />
    </Link>
  );
}
