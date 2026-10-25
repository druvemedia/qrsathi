"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, FileSpreadsheet } from "lucide-react";
import { QR_TYPES, type QrTypeDef } from "@/lib/qr-types";
import { TypeIcon } from "@/components/icon";
import { SearchInput } from "@/components/ui";
import { cn } from "@/lib/utils";

/** User-facing groupings (independent of the registry's internal categories). */
export const TYPE_GROUPS: { id: string; label: string; types: string[] }[] = [
  { id: "web", label: "Web", types: ["url", "dynamic", "file", "links", "landing"] },
  { id: "contact", label: "Contact", types: ["vcard", "phone", "sms", "email"] },
  { id: "social", label: "Social", types: ["whatsapp", "instagram", "facebook", "youtube", "linkedin"] },
  { id: "wifi", label: "Wi-Fi", types: ["wifi"] },
  { id: "payments", label: "Payments", types: ["upi", "bank"] },
  { id: "business", label: "Business", types: ["maps", "product", "app", "menu", "business", "feedback", "coupon"] },
  { id: "other", label: "Other", types: ["text", "event"] },
];
export const POPULAR_TYPES = ["url", "upi", "whatsapp", "wifi", "vcard", "text", "instagram", "maps"];

function TypeCard({ t, selected, onClick, disabled }: { t: QrTypeDef; selected: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      className={cn("flex min-w-0 items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        selected ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/60")}>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", selected ? "bg-brand text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>
        <TypeIcon name={t.icon} className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{t.label}</span>
        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{t.description}</span>
      </span>
    </button>
  );
}

export function CodeTypeSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [group, setGroup] = useState<string>("popular");
  const [q, setQ] = useState("");
  const [more, setMore] = useState(false);
  const byId = useMemo(() => Object.fromEntries(QR_TYPES.map((t) => [t.id, t])), []);

  const searching = q.trim().length > 0;
  const shown: QrTypeDef[] = searching
    ? QR_TYPES.filter((t) => `${t.label} ${t.description} ${t.id}`.toLowerCase().includes(q.trim().toLowerCase()))
    : group === "popular"
      ? POPULAR_TYPES.map((id) => byId[id])
      : (TYPE_GROUPS.find((g) => g.id === group)?.types ?? []).map((id) => byId[id]).filter(Boolean);
  const rest = QR_TYPES.filter((t) => !POPULAR_TYPES.includes(t.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 scrollbar-thin" role="tablist" aria-label="QR type categories">
          {[{ id: "popular", label: "Popular" }, ...TYPE_GROUPS].map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={!searching && group === g.id} onClick={() => { setGroup(g.id); setQ(""); }}
              className={cn("whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                !searching && group === g.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
              {g.label}
            </button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search types" className="sm:ml-auto sm:w-44" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {shown.map((t) => <TypeCard key={t.id} t={t} selected={t.id === value} onClick={() => onChange(t.id)} />)}
        {searching && shown.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-500">No type matches “{q}”.</p>}
      </div>

      {!searching && group === "popular" && (
        <div>
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", more && "rotate-180")} aria-hidden /> {more ? "Fewer types" : `More types (${rest.length})`}
          </button>
          {more && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {rest.map((t) => <TypeCard key={t.id} t={t} selected={t.id === value} onClick={() => onChange(t.id)} />)}
              <Link href="/bulk" className="flex items-center gap-2.5 rounded-lg border border-dashed border-slate-300 p-2.5 text-left hover:border-brand dark:border-slate-700">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><FileSpreadsheet className="h-4 w-4" /></span>
                <span><span className="block text-[13px] font-medium">Bulk from CSV/Excel</span><span className="block text-[11px] text-slate-500">Hundreds at once</span></span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
