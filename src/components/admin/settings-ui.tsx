"use client";
/**
 * Building blocks for admin settings pages: label/description on the left and
 * controls on the right (instead of a stack of cards), a sticky section nav
 * with scroll-spy, and a save bar that appears only when there are changes.
 */
import { useEffect, useState } from "react";
import { CircleDot } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function SettingsGroup({ id, title, description, actions, children, stacked, className }: {
  id?: string; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
  /** Heading above the controls (for narrow columns, e.g. next to a preview). */
  stacked?: boolean; className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined}
      className={cn("scroll-mt-28 border-t border-slate-200/80 py-8 first:border-t-0 first:pt-2 dark:border-slate-800", !stacked && "lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10", className)}>
      <div className={cn("mb-5", !stacked && "lg:mb-0")}>
        <div className="flex items-start justify-between gap-3">
          <h2 id={id ? `${id}-h` : undefined} className="font-serif text-lg font-medium">{title}</h2>
          {actions && <div className={cn("shrink-0", !stacked && "lg:hidden")}>{actions}</div>}
        </div>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        {actions && !stacked && <div className="mt-3 hidden lg:block">{actions}</div>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

/** Sticky chips linking to the page's SettingsGroup ids; highlights the one in view. */
export function SettingsNav({ items }: { items: [id: string, label: string][] }) {
  const [active, setActive] = useState(items[0]?.[0]);
  useEffect(() => {
    const els = items.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: "-120px 0px -55% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label="Settings sections" className="sticky top-14 z-10 -mx-4 mb-2 bg-slate-50/85 px-4 py-2 backdrop-blur-xl dark:bg-slate-950/85 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 overflow-x-auto scrollbar-thin">
        {items.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={active === id ? "true" : undefined}
              className={cn("block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active === id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-900")}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Sticky bottom bar shown while a form has unsaved changes. */
export function SaveBar({ dirty, busy, onCancel, saveLabel = "Save changes", note, submit = true, onSave }: {
  dirty: boolean; busy?: boolean; onCancel: () => void; saveLabel?: string; note?: React.ReactNode; submit?: boolean; onSave?: () => void;
}) {
  if (!dirty) return note ? <p className="pt-2 text-xs text-slate-500">{note}</p> : null;
  return (
    <div className="sticky bottom-4 z-20 mt-6 flex animate-dropdown-in flex-wrap items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-pop dark:bg-white dark:text-slate-900" role="region" aria-label="Unsaved changes">
      <CircleDot className="h-4 w-4 text-amber-400 dark:text-amber-500" aria-hidden />
      <span className="text-sm font-medium">Unsaved changes</span>
      {note && <span className="hidden text-xs opacity-60 md:inline">{note}</span>}
      <div className="ml-auto flex gap-2">
        <Button type="button" size="sm" variant="ghost" className="text-current hover:bg-white/10 dark:hover:bg-slate-900/10" onClick={onCancel} disabled={busy}>Discard</Button>
        <Button type={submit ? "submit" : "button"} size="sm" variant="secondary" loading={busy} onClick={submit ? undefined : onSave}>{saveLabel}</Button>
      </div>
    </div>
  );
}

/** Large status line for an integration: icon tile, label, supporting detail. */
export function StatusHero({ tone, icon, title, detail, children }: { tone: "green" | "amber" | "rose" | "slate"; icon: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; children?: React.ReactNode }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
    amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
    rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25",
    slate: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  };
  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ring-inset [&>svg]:h-5 [&>svg]:w-5", tones[tone])} aria-hidden>{icon}</span>
        <div className="min-w-0">
          <p className="font-serif text-2xl leading-tight">{title}</p>
          {detail && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{detail}</p>}
        </div>
      </div>
      {children && <div className="md:shrink-0">{children}</div>}
    </div>
  );
}

/** Ordered checklist built from real state (never pre-ticked). */
export function SetupSteps({ steps }: { steps: { label: string; done: boolean; hint?: React.ReactNode }[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label="Setup progress" aria-valuenow={done} aria-valuemin={0} aria-valuemax={steps.length}>
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums text-slate-500">{done}/{steps.length}</span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-3 text-sm">
            <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
              s.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:ring-slate-700")}>
              {s.done ? "✓" : i + 1}<span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
            </span>
            <span className="min-w-0">
              <span className={cn(s.done ? "text-slate-500 dark:text-slate-400" : "font-medium")}>{s.label}</span>
              {s.hint && !s.done && <span className="block text-xs text-slate-500">{s.hint}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
