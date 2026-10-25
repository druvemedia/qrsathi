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
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 px-6 py-14 text-center text-white sm:px-12">
        <div className="pointer-events-none absolute inset-0" aria-hidden style={{ background: "radial-gradient(50% 80% at 50% 0%, hsl(var(--brand) / .5), transparent 70%)" }} />
        <h2 className="relative mx-auto max-w-2xl font-serif text-3xl leading-tight tracking-[-0.02em] sm:text-4xl">{title}</h2>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href={primary[0]} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:-translate-y-px active:scale-[0.98]">{primary[1]} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          {secondary && <Link href={secondary[0]} className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium ring-1 ring-inset ring-white/25 transition hover:bg-white/10">{secondary[1]}</Link>}
        </div>
      </div>
    </section>
  );
}

export interface ShowcaseItem { icon: LucideIcon; title: string; text: string; href?: string }

/** Alternating visual + text section: one demonstration, a few one-line capabilities. */
export function Showcase({ id, eyebrow, title, lede, items, visual, flip, cta }: {
  id?: string; eyebrow: string; title: string; lede?: string; items: ShowcaseItem[]; visual: React.ReactNode; flip?: boolean; cta?: [string, string];
}) {
  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className={cn(flip && "lg:order-2")}>
          <p className="text-sm font-medium text-brand">{eyebrow}</p>
          <h2 id={id ? `${id}-h` : undefined} className="mt-3 font-serif text-4xl leading-[1.08] tracking-[-0.02em]">{title}</h2>
          {lede && <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">{lede}</p>}
          <ul className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {items.map((f) => {
              const body = (
                <>
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/10 text-brand"><f.icon className="h-3.5 w-3.5" aria-hidden /></span>
                    {f.title}
                    {f.href && <ArrowRight className="h-3.5 w-3.5 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />}
                  </span>
                  <span className="mt-1.5 block pl-9 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.text}</span>
                </>
              );
              return <li key={f.title}>{f.href ? <Link href={f.href} className="group block">{body}</Link> : body}</li>;
            })}
          </ul>
          {cta && <Link href={cta[0]} className="mt-9 inline-flex h-11 items-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition hover:-translate-y-px active:scale-[0.98] dark:bg-white dark:text-zinc-950">{cta[1]} <ArrowRight className="h-4 w-4" aria-hidden /></Link>}
        </div>
        <div className={cn("relative", flip && "lg:order-1")}>{visual}</div>
      </div>
    </section>
  );
}
