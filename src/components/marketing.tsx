/** Server-safe building blocks for public marketing pages (editorial layout, no client state). */
import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageIntro({ eyebrow, title, lede, children }: { eyebrow?: string; title: React.ReactNode; lede?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 lg:pt-24">
      <div className="max-w-3xl">
        {eyebrow && <p className="text-sm font-medium text-brand">{eyebrow}</p>}
        <h1 className="mt-3 font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl">{title}</h1>
        {lede && <p className="mt-5 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">{lede}</p>}
        {children}
      </div>
    </header>
  );
}

export function Band({ children, tone = "plain", className, id }: { children: React.ReactNode; tone?: "plain" | "surface"; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("border-t border-zinc-200 dark:border-zinc-800", tone === "surface" && "bg-white dark:bg-zinc-950", className)}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">{children}</div>
    </section>
  );
}

export function SectionTitle({ title, lede, aside }: { title: string; lede?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <h2 className="font-serif text-3xl leading-tight tracking-tight">{title}</h2>
        {lede && <p className="mt-3 text-zinc-600 dark:text-zinc-400">{lede}</p>}
      </div>
      {aside}
    </div>
  );
}

export interface FeatureItem { icon: LucideIcon; title: string; text: string; href?: string; tag?: string }

export function FeatureGrid({ items, cols = 3 }: { items: FeatureItem[]; cols?: 2 | 3 }) {
  return (
    <ul className={cn("mt-10 grid gap-x-10", cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
      {items.map((f) => {
        const body = (
          <>
            <div className="flex items-center gap-2">
              <f.icon className="h-4 w-4 text-brand" aria-hidden />
              <h3 className="font-medium">{f.title}</h3>
              {f.tag && <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 dark:border-zinc-700">{f.tag}</span>}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.text}</p>
          </>
        );
        return (
          <li key={f.title} className="border-t border-zinc-200 py-6 dark:border-zinc-800">
            {f.href ? <Link href={f.href} className="group block">{body}<span className="mt-3 inline-flex items-center gap-1 text-sm text-brand opacity-80 group-hover:opacity-100">Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /></span></Link> : body}
          </li>
        );
      })}
    </ul>
  );
}

export function CtaBand({ title, primary, secondary }: { title: string; primary: [string, string]; secondary?: [string, string] }) {
  return (
    <section className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <h2 className="mx-auto max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={primary[0]} className="inline-flex h-11 items-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-fg transition-transform active:scale-[0.98]">{primary[1]}</Link>
          {secondary && <Link href={secondary[0]} className="inline-flex h-11 items-center rounded-lg border border-zinc-300 px-5 text-sm font-medium transition-colors hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900">{secondary[1]}</Link>}
        </div>
      </div>
    </section>
  );
}
