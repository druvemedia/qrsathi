"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { QR_TYPES, type QrTypeDef } from "@/lib/qr-types";
import { TypeGlyph } from "@/components/brand-icon";
import { SearchInput } from "@/components/ui";
import { cn } from "@/lib/utils";

/** User-facing groupings (independent of the registry's internal categories). */
export const TYPE_GROUPS: { id: string; label: string; types: string[] }[] = [
  { id: "web", label: "Web", types: ["url", "dynamic", "file", "links", "landing"] },
  { id: "social", label: "Social", types: ["whatsapp", "instagram", "facebook", "youtube", "linkedin", "tiktok", "x", "telegram", "snapchat", "spotify"] },
  { id: "contact", label: "Contact", types: ["vcard", "phone", "sms", "email"] },
  { id: "payments", label: "Payments", types: ["upi", "bank"] },
  { id: "business", label: "Business", types: ["maps", "product", "app", "menu", "business", "feedback", "coupon"] },
  { id: "other", label: "Wi-Fi & more", types: ["wifi", "text", "event"] },
];
export const POPULAR_TYPES = ["url", "upi", "whatsapp", "wifi", "vcard", "instagram", "maps", "links", "menu", "youtube", "event", "text"];

/** Square tile: glyph above a one-line label. The description is the tooltip. */
function TypeTile({ t, selected, onClick }: { t: QrTypeDef; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} title={t.description}
      className={cn("group relative flex min-w-0 flex-col items-center gap-2 rounded-2xl border px-1.5 pb-2.5 pt-3 text-center transition duration-200",
        selected
          ? "border-brand bg-brand/[0.06] ring-1 ring-brand"
          : "border-transparent hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-card dark:hover:border-slate-700 dark:hover:bg-slate-900")}>
      <TypeGlyph brand={t.brand} icon={t.icon} className={cn("transition-transform duration-200 group-hover:scale-105", selected && !t.brand && "bg-brand text-white dark:bg-brand dark:text-white")} />
      <span className="w-full truncate text-[12px] font-medium leading-tight text-slate-700 dark:text-slate-200">{t.label}</span>
    </button>
  );
}

export function CodeTypeSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [group, setGroup] = useState<string>("popular");
  const [q, setQ] = useState("");
  const byId = useMemo(() => Object.fromEntries(QR_TYPES.map((t) => [t.id, t])), []);

  const query = q.trim().toLowerCase();
  const shown: QrTypeDef[] = query
    ? QR_TYPES.filter((t) => `${t.label} ${t.description} ${t.id}`.toLowerCase().includes(query))
    : group === "all"
      ? QR_TYPES
      : (group === "popular" ? POPULAR_TYPES : TYPE_GROUPS.find((g) => g.id === group)?.types ?? []).map((id) => byId[id]).filter(Boolean);
  const groups = [{ id: "popular", label: "Popular" }, ...TYPE_GROUPS, { id: "all", label: `All ${QR_TYPES.length}` }];

  return (
    <div className="space-y-3">
      <SearchInput value={q} onChange={setQ} placeholder={`Search ${QR_TYPES.length} QR types`} aria-label="Search QR types" />
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 scrollbar-thin" role="tablist" aria-label="QR type categories">
        {groups.map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={!query && group === g.id} onClick={() => { setGroup(g.id); setQ(""); }}
            className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
              !query && group === g.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
            {g.label}
          </button>
        ))}
      </div>

      <div key={query || group} className="grid animate-fade-in grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6">
        {shown.map((t) => <TypeTile key={t.id} t={t} selected={t.id === value} onClick={() => onChange(t.id)} />)}
        {!query && group === "all" && (
          <Link href="/bulk" title="Generate hundreds of codes from a CSV or Excel file"
            className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-1.5 pb-2.5 pt-3 text-center transition hover:border-brand dark:border-slate-700">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><FileSpreadsheet className="h-5 w-5" aria-hidden /></span>
            <span className="w-full truncate text-[12px] font-medium">Bulk (CSV)</span>
          </Link>
        )}
        {query && shown.length === 0 && <p className="col-span-full py-6 text-center text-sm text-slate-500">No type matches “{q}”.</p>}
      </div>
    </div>
  );
}
