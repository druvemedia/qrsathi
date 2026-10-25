import type { SVGProps } from "react";
import { brandMark, isDarkMark } from "@/lib/brand-icons";
import { TypeIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

/**
 * Official brand mark in its brand colour (near-black marks flip to white in
 * dark mode). `mono` uses currentColor instead. Falls back to `fallback`
 * (a lucide name) when the brand is unknown.
 */
export function BrandIcon({ brand, mono, fallback = "QrCode", className, title, ...rest }:
  { brand: string; mono?: boolean; fallback?: string; title?: string } & SVGProps<SVGSVGElement>) {
  const m = brandMark(brand);
  if (!m) return <TypeIcon name={fallback} className={className} aria-hidden />;
  const dark = !mono && isDarkMark(m);
  return (
    <svg viewBox="0 0 24 24" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}
      className={cn(dark && "fill-[#111] dark:fill-white", className)} fill={mono ? "currentColor" : dark ? undefined : m.hex} {...rest}>
      <path d={m.path} />
    </svg>
  );
}

/** Icon tile used by type pickers: brand mark on a tinted square, or a lucide icon. */
export function TypeGlyph({ brand, icon, className, size = "md" }: { brand?: string; icon: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const m = brandMark(brand);
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
  const ic = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <span className={cn("grid shrink-0 place-items-center", box, m ? "bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", className)}>
      {m ? <BrandIcon brand={brand!} className={ic} /> : <TypeIcon name={icon} className={ic} aria-hidden />}
    </span>
  );
}
