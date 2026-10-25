"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Search } from "lucide-react";
import { CATEGORIES, QR_TYPES, type Category } from "@/lib/qr-types";
import { TypeIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

export function TypePicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [cat, setCat] = useState<Category | "all">("all");
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      QR_TYPES.filter((t) => (cat === "all" || t.category === cat) && (!q || `${t.label} ${t.description}`.toLowerCase().includes(q.toLowerCase()))),
    [cat, q],
  );
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {[{ id: "all" as const, label: "All" }, ...CATEGORIES].map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)}
              className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition",
                cat === c.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300")}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search types" aria-label="Search QR types" className="input py-2 pl-9 text-xs" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {list.map((t) => (
          <button key={t.id} type="button" disabled={disabled && t.id !== value} onClick={() => onChange(t.id)} aria-pressed={t.id === value}
            className={cn("flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
              t.id === value ? "border-brand bg-brand/5 ring-2 ring-brand/15" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50")}>
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", t.id === value ? "bg-brand text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>
              <TypeIcon name={t.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{t.label}</span>
              <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{t.description}</span>
            </span>
          </button>
        ))}
        {(cat === "all" || cat === "files") && !q && (
          <Link href="/bulk" className="flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 p-2.5 transition hover:border-brand hover:bg-brand/5 dark:border-slate-700">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><FileSpreadsheet className="h-4 w-4" /></span>
            <span><span className="block text-[13px] font-semibold">Bulk from CSV/Excel</span><span className="block text-[11px] text-slate-500">Hundreds at once</span></span>
          </Link>
        )}
      </div>
    </div>
  );
}
