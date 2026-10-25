"use client";
import { useMemo, useState } from "react";
import { Barcode, CreditCard, IndianRupee, LifeBuoy, LineChart, Palette, QrCode, RefreshCw, UserRound, type LucideIcon } from "lucide-react";
import { SearchInput } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface HelpItem { q: string; a: React.ReactNode; /** Plain text used for searching. */ k: string }
export interface HelpSection { id: string; title: string; icon: string; blurb: string; items: HelpItem[] }

const ICONS: Record<string, LucideIcon> = { start: QrCode, design: Palette, upi: IndianRupee, dynamic: RefreshCw, barcodes: Barcode, privacy: LineChart, account: UserRound, billing: CreditCard, trouble: LifeBuoy };

export function HelpCenter({ sections }: { sections: HelpSection[] }) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string>("");
  const term = q.trim().toLowerCase();
  const filtered = useMemo(() => sections
    .filter((s) => !topic || s.id === topic)
    .map((s) => ({ ...s, items: term ? s.items.filter((i) => `${i.q} ${i.k}`.toLowerCase().includes(term)) : s.items }))
    .filter((s) => s.items.length), [sections, topic, term]);
  const count = filtered.reduce((n, s) => n + s.items.length, 0);

  return (
    <div>
      <div className="mx-auto max-w-2xl">
        <SearchInput value={q} onChange={setQ} placeholder="Search help — e.g. print size, UPI, camera" aria-label="Search help" className="[&_input]:h-12 [&_input]:rounded-2xl [&_input]:text-base [&_input]:shadow-card" />
        <p className="mt-2 text-center text-xs text-zinc-500" aria-live="polite">{term || topic ? `${count} answer${count === 1 ? "" : "s"}` : `${sections.reduce((n, s) => n + s.items.length, 0)} answers in ${sections.length} topics`}</p>
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Help topics">
        {sections.map((s) => {
          const Icon = ICONS[s.icon] ?? LifeBuoy;
          const on = topic === s.id;
          return (
            <li key={s.id}>
              <button type="button" onClick={() => setTopic(on ? "" : s.id)} aria-pressed={on}
                className={cn("flex h-full w-full flex-col items-start gap-3 rounded-2xl border p-4 text-left transition duration-200",
                  on ? "border-brand bg-brand/[0.06] ring-1 ring-brand" : "border-zinc-200 bg-white hover:-translate-y-0.5 hover:shadow-card dark:border-zinc-800 dark:bg-zinc-900")}>
                <span className={cn("grid h-9 w-9 place-items-center rounded-xl", on ? "bg-brand text-white" : "bg-brand/10 text-brand")}><Icon className="h-4 w-4" aria-hidden /></span>
                <span>
                  <span className="block text-sm font-semibold">{s.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{s.blurb}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div key={topic + term} className="mt-14 animate-fade-in space-y-12">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
            <p className="font-serif text-xl">No answers match “{q}”</p>
            <button type="button" onClick={() => { setQ(""); setTopic(""); }} className="mt-3 text-sm font-medium text-brand hover:underline">Clear search</button>
          </div>
        ) : filtered.map((s) => (
          <section key={s.id} id={s.id} className="grid scroll-mt-24 gap-6 md:grid-cols-[220px_1fr]" aria-labelledby={`${s.id}-h`}>
            <h2 id={`${s.id}-h`} className="font-serif text-2xl tracking-[-0.01em]">{s.title}</h2>
            <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {s.items.map((i) => (
                <details key={i.q} className="group py-4 [&_summary::-webkit-details-marker]:hidden" open={!!term && s.items.length <= 2}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {i.q}<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-500 transition-transform duration-200 group-open:rotate-45 dark:border-zinc-700" aria-hidden>+</span>
                  </summary>
                  <div className="mt-3 max-w-3xl animate-fade-up text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 [&_a]:font-medium [&_a]:text-brand [&_a:hover]:underline">{i.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
