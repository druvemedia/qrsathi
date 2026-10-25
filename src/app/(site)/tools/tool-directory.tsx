"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight, BarChart3, Barcode, Boxes, FileSpreadsheet, History, IndianRupee, Library, Package, Palette, QrCode, RefreshCw, ScanLine, Tags, type LucideIcon,
} from "lucide-react";
import { SearchInput } from "@/components/ui";
import { cn } from "@/lib/utils";

type Group = "qr" | "barcode" | "scan" | "business";
interface Tool { href: string; icon: LucideIcon; title: string; text: string; group: Group; account?: boolean; keywords?: string }

const TOOLS: Tool[] = [
  { href: "/generator", icon: QrCode, title: "QR code generator", text: "Every QR type with a live preview and scan test.", group: "qr", keywords: "url link wifi vcard whatsapp instagram menu" },
  { href: "/studio", icon: Palette, title: "Design studio", text: "Colours, shapes, logos and frames.", group: "qr", keywords: "customise style logo frame" },
  { href: "/upi", icon: IndianRupee, title: "UPI payment QR", text: "Counter QR and printable standee.", group: "qr", keywords: "payment gpay phonepe paytm bhim standee" },
  { href: "/dynamic", icon: RefreshCw, title: "Dynamic QR", text: "Editable short links with analytics.", group: "qr", account: true, keywords: "edit redirect short link" },
  { href: "/bulk", icon: FileSpreadsheet, title: "Bulk generator", text: "QR codes or barcodes from CSV/Excel.", group: "qr", keywords: "csv excel spreadsheet zip many" },
  { href: "/barcodes", icon: Barcode, title: "Barcode generator", text: "EAN, UPC, Code 128, GS1, Data Matrix and more.", group: "barcode", keywords: "ean upc isbn code128 gs1 datamatrix pdf417 label" },
  { href: "/bulk?mode=barcode", icon: Tags, title: "Bulk barcodes & labels", text: "Validated barcodes and label sheets in bulk.", group: "barcode", keywords: "csv labels print sheet" },
  { href: "/scanner", icon: ScanLine, title: "Universal scanner", text: "Camera or image; decoding stays on your device.", group: "scan", keywords: "scan read camera image decode" },
  { href: "/scan-history", icon: History, title: "Scan history", text: "Codes you've scanned on this device.", group: "scan", keywords: "recent scans" },
  { href: "/products", icon: Package, title: "Products", text: "SKUs, prices, batches and barcodes.", group: "business", account: true, keywords: "catalogue sku inventory" },
  { href: "/inventory", icon: Boxes, title: "Inventory", text: "Stock in, stock out and low-stock alerts.", group: "business", account: true, keywords: "stock warehouse" },
  { href: "/analytics", icon: BarChart3, title: "Scan analytics", text: "Scans by day, device and country.", group: "business", account: true, keywords: "stats reports" },
  { href: "/codes", icon: Library, title: "QR library", text: "Every code you've saved.", group: "business", account: true, keywords: "saved my codes" },
];
const GROUPS: { id: Group | "all"; label: string }[] = [
  { id: "all", label: "All" }, { id: "qr", label: "QR codes" }, { id: "barcode", label: "Barcodes" }, { id: "scan", label: "Scanning" }, { id: "business", label: "Business" },
];

export function ToolDirectory({ qrPreview, barcodePreview }: { qrPreview: string; barcodePreview: string }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group | "all">("all");
  const term = q.trim().toLowerCase();
  const shown = useMemo(() => TOOLS.filter((t) => (group === "all" || t.group === group) && (!term || `${t.title} ${t.text} ${t.keywords ?? ""}`.toLowerCase().includes(term))), [group, term]);

  return (
    <div>
      {/* Two flagship tools with live samples */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { href: "/generator", title: "QR code generator", text: "Links, Wi-Fi, payments, social profiles and more.", svg: qrPreview, square: true },
          { href: "/barcodes", title: "Barcode generator", text: "Retail and logistics barcodes with check digits.", svg: barcodePreview, square: false },
        ].map((t) => (
          <Link key={t.href} href={t.href} className="group relative flex items-center gap-6 overflow-hidden rounded-[1.75rem] bg-zinc-950 p-6 text-white transition hover:-translate-y-0.5 sm:p-8">
            <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden style={{ background: "radial-gradient(60% 80% at 100% 0%, hsl(var(--brand) / .5), transparent 70%)" }} />
            <div className={cn("relative shrink-0 rounded-2xl bg-white p-3 shadow-xl transition duration-300 group-hover:rotate-[-3deg]", t.square ? "w-28" : "w-40")}>
              <div className="[&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`${t.title} sample`} dangerouslySetInnerHTML={{ __html: t.svg }} />
            </div>
            <div className="relative min-w-0">
              <h2 className="font-serif text-2xl">{t.title}</h2>
              <p className="mt-1 text-sm text-white/65">{t.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-14 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-thin" role="tablist" aria-label="Tool categories">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)}
              className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors",
                group === g.id ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" : "text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-900")}>
              {g.label}
            </button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search tools" aria-label="Search tools" className="w-full md:w-72" />
      </div>

      <p className="sr-only" aria-live="polite">{shown.length} tools shown</p>
      {shown.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
          <p className="font-serif text-xl">No tool matches “{q}”</p>
          <button type="button" onClick={() => { setQ(""); setGroup("all"); }} className="mt-3 text-sm font-medium text-brand hover:underline">Show all tools</button>
        </div>
      ) : (
        <ul key={group + term} className="mt-6 grid animate-fade-in divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 md:grid-cols-2 md:gap-x-10 md:divide-y-0 md:border-0">
          {shown.map((t) => (
            <li key={t.href} className="md:border-b md:border-zinc-200 md:dark:border-zinc-800">
              <Link href={t.href} className="group flex items-center gap-4 py-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-brand shadow-sm ring-1 ring-zinc-200 transition group-hover:scale-105 dark:bg-zinc-900 dark:ring-zinc-800">
                  <t.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {t.title}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", t.account ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300")}>
                      {t.account ? "Free account" : "No sign-up"}
                    </span>
                  </span>
                  <span className="block truncate text-sm text-zinc-500">{t.text}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
