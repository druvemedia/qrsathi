"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Barcode, Boxes, CheckCircle2, ChevronDown, Download, FileSpreadsheet, Info, PackagePlus, Printer, Tag, XCircle } from "lucide-react";
import { BARCODE_MAP, getBarcodeFormat, renderBarcodeSvg, validateBarcode, type BarcodeFormatDef } from "@/lib/barcodes";
import { loadPrefs } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { Alert, Badge, Disclosure, Field, Input, Modal, Segmented, Textarea, Button } from "@/components/ui";
import { useApp } from "@/components/providers";
import { trackDownload } from "@/components/qr/export-panel";
import {
  DEFAULT_BARCODE_STYLE, DEFAULT_LABEL, ExportButtons, GtinNotice, LabelDesigner, ScannableBadge, StyleControls, useBarcodeSvg,
  type BarcodeStyle, type LabelSettings,
} from "./barcode-ui";

const KEY = "qrsathi:barcode:v1";

type Kind = "product" | "custom";
const GROUPS: Record<Kind, { common: string[]; more: string[] }> = {
  product: { common: ["ean13", "ean8", "upca", "upce"], more: ["isbn", "issn", "itf14", "gs1-128", "gs1datamatrix"] },
  custom: { common: ["code128", "code39", "code93", "codabar"], more: ["itf", "datamatrix", "pdf417", "aztec", "microqr", "gs1qr", "std2of5", "msi"] },
};
const WHEN: Record<string, string> = {
  ean13: "Retail products sold in shops (most of the world)",
  ean8: "Small retail packs with little space",
  upca: "Retail products for US/Canada",
  upce: "Very small US packs (compressed UPC)",
  isbn: "Books", issn: "Magazines & journals",
  itf14: "Outer cartons and cases", "gs1-128": "Shipping labels with batch & expiry", gs1datamatrix: "Pharma & traceability",
  code128: "Internal SKUs, inventory & asset tags", code39: "Older industrial & ID systems", code93: "Compact Code 39 alternative", codabar: "Libraries, labs, couriers",
  itf: "Numeric warehouse codes", datamatrix: "Tiny 2D marks on parts", pdf417: "IDs & documents", aztec: "Tickets & passes",
  microqr: "Very short data in tiny spaces", gs1qr: "QR with GS1 product data", std2of5: "Legacy industrial (generate only)", msi: "Legacy shelf labels (generate only)",
};
const kindOf = (id: string): Kind => (GROUPS.product.common.includes(id) || GROUPS.product.more.includes(id) ? "product" : "custom");

/** Tile with a real miniature of the format, rendered from its example value. */
function FormatTile({ f, selected, onClick }: { f: BarcodeFormatDef; selected: boolean; onClick: () => void }) {
  const thumb = useMemo(() => {
    try {
      const v = validateBarcode(f.id, f.example);
      return renderBarcodeSvg(f.id, v.ok ? v.value : f.example, { scale: 1, heightMm: 6, showText: false, margin: 2 });
    } catch {
      return "";
    }
  }, [f.id, f.example]);
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} title={WHEN[f.id]}
      className={cn("group flex min-w-0 flex-col rounded-2xl border p-2.5 text-left transition duration-200",
        selected ? "border-brand bg-brand/[0.06] ring-1 ring-brand" : "border-slate-200/80 bg-white hover:-translate-y-0.5 hover:shadow-card dark:border-slate-800 dark:bg-slate-900")}>
      <span className="grid h-14 place-items-center rounded-xl bg-white px-2 ring-1 ring-inset ring-slate-100 dark:ring-0" aria-hidden>
        {thumb && <span className={cn("block [&>svg]:h-auto [&>svg]:w-full", f.dims === "2d" ? "w-10" : "w-full max-w-[110px]")} dangerouslySetInnerHTML={{ __html: thumb }} />}
      </span>
      <span className="mt-2 flex items-center gap-1.5 truncate text-[13px] font-medium">{f.label}{!f.scannable && <Badge tone="amber">Generate only</Badge>}</span>
      <span className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">{WHEN[f.id]}</span>
    </button>
  );
}

const step = (n: number, label: string) => (
  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
    <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] text-white dark:bg-white dark:text-slate-900">{n}</span>{label}
  </span>
);

export function BarcodeGenerator() {
  const { user } = useApp();
  const [format, setFormat] = useState("ean13");
  const [kind, setKind] = useState<Kind>("product");
  const [moreOpen, setMoreOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [style, setStyle] = useState<BarcodeStyle>(DEFAULT_BARCODE_STYLE);
  const [label, setLabel] = useState<LabelSettings>({ ...DEFAULT_LABEL, layout: "barcode" });
  const [labelData, setLabelData] = useState({ name: "", variant: "", price: "", sku: "" });
  const [printOpen, setPrintOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [view, setView] = useState<"code" | "pack">("code");

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      const prefs = loadPrefs();
      const f = s?.format && BARCODE_MAP[s.format] ? s.format : BARCODE_MAP[prefs.barcodeFormat] ? prefs.barcodeFormat : "ean13";
      setFormat(f);
      setKind(kindOf(f));
      setMoreOpen(!GROUPS[kindOf(f)].common.includes(f));
      setLabel((l) => ({ ...l, sizeId: prefs.labelSize || l.sizeId }));
      if (s?.values) setValues(s.values);
      if (s?.style) setStyle({ ...DEFAULT_BARCODE_STYLE, ...s.style });
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ format, values, style })); } catch {}
  }, [format, values, style]);

  const f = getBarcodeFormat(format);
  const raw = values[format] ?? f.example;
  const v = useMemo(() => validateBarcode(format, raw), [format, raw]);
  const { svg, error } = useBarcodeSvg(format, v.ok ? v.value : null, style);
  const name = `${f.id}-${v.ok ? v.value : "barcode"}`;
  const problem = error || (!v.ok && raw ? v.error : "");

  const chooseKind = (k: Kind) => {
    setKind(k);
    if (kindOf(format) !== k) { setFormat(GROUPS[k].common[0]); setMoreOpen(false); }
  };

  const code = (cls = "") => (
    <div className={cn("[&>svg]:h-auto [&>svg]:max-h-[300px] [&>svg]:w-full", cls)} dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="Barcode preview" />
  );

  return (
    <div className="space-y-4">
      <Segmented className="flex w-full lg:hidden [&>button]:flex-1" value={mobileView} onChange={setMobileView}
        options={[{ value: "edit", label: "Edit" }, { value: "preview", label: "Preview & download" }]} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:gap-8">
        <div className={cn("min-w-0 space-y-6", mobileView === "preview" && "hidden lg:block")}>
          <section aria-labelledby="bc-type-h">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="bc-type-h">{step(1, "Barcode type")}</h2>
              <Segmented size="sm" value={kind} onChange={chooseKind} options={[
                { value: "product", label: <span className="flex items-center gap-1.5 px-1"><Tag className="h-3.5 w-3.5" aria-hidden /> Product</span> },
                { value: "custom", label: <span className="flex items-center gap-1.5 px-1"><Barcode className="h-3.5 w-3.5" aria-hidden /> Custom</span> },
              ]} />
            </div>
            <div key={kind} className="grid animate-fade-in grid-cols-2 gap-2 sm:grid-cols-4">
              {GROUPS[kind].common.map((id) => <FormatTile key={id} f={BARCODE_MAP[id]} selected={format === id} onClick={() => setFormat(id)} />)}
              {moreOpen && GROUPS[kind].more.map((id) => <FormatTile key={id} f={BARCODE_MAP[id]} selected={format === id} onClick={() => setFormat(id)} />)}
            </div>
            <button type="button" onClick={() => setMoreOpen((m) => !m)} aria-expanded={moreOpen}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} aria-hidden /> {moreOpen ? "Fewer formats" : `More formats (${GROUPS[kind].more.length})`}
            </button>
          </section>

          <section aria-labelledby="bc-data-h">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="bc-data-h">{step(2, `${f.label} data`)}</h2>
              <ScannableBadge formatId={format} />
            </div>
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <p className="text-xs text-slate-500 dark:text-slate-400">{f.description}</p>
              <Field label="Data to encode" htmlFor="bc-data" error={!v.ok && raw ? v.error : undefined}
                hint={v.ok ? undefined : `Example: ${f.example}`}>
                {f.dims === "2d"
                  ? <Textarea id="bc-data" rows={3} value={raw} placeholder={f.placeholder} onChange={(e) => setValues((s) => ({ ...s, [format]: e.target.value }))} invalid={!v.ok && !!raw} />
                  : <Input id="bc-data" value={raw} placeholder={f.placeholder} onChange={(e) => setValues((s) => ({ ...s, [format]: e.target.value }))} invalid={!v.ok && !!raw} className="h-12 font-mono text-base tracking-wider" spellCheck={false} autoComplete="off" />}
              </Field>
              {v.ok ? (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" aria-hidden /> Valid {f.label}: <span className="font-mono">{v.display}</span></p>
                  {v.warnings.map((w) => <p key={w} className="flex items-start gap-1.5 text-xs text-slate-500"><Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> {w}</p>)}
                </div>
              ) : raw ? (
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><XCircle className="h-3.5 w-3.5 text-rose-500" aria-hidden /> Fix the data above, or pick a format that fits it.</p>
              ) : null}
              <GtinNotice formatId={format} />
              <Disclosure title="Advanced settings" description="Size, bar height, quiet zone, colours, human-readable text">
                <StyleControls style={style} onChange={setStyle} dims={f.dims} />
              </Disclosure>
            </div>
          </section>
          <Button variant="outline" className="w-full lg:hidden" onClick={() => { setMobileView("preview"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Preview & download</Button>
        </div>

        <div className={cn("space-y-4 self-start lg:sticky lg:top-20", mobileView === "edit" && "hidden lg:block")}>
          <div className="flex items-center justify-between gap-3">
            <h2>{step(3, "Preview & download")}</h2>
            <Badge tone="violet">{f.label}</Badge>
          </div>
          <div className="stage relative overflow-hidden rounded-3xl">
            <div className="grid min-h-[320px] place-items-center px-6 pb-16 pt-10">
              {!svg ? (
                <p className="max-w-xs rounded-2xl bg-white/95 px-4 py-3 text-center text-sm text-slate-600 shadow-sm dark:bg-slate-900/95 dark:text-slate-300">
                  {problem ? <span className="text-rose-600 dark:text-rose-400">{problem}</span> : "Enter valid data to see the barcode"}
                </p>
              ) : view === "code" ? (
                <div key="code" className="w-full max-w-[320px] animate-scale-in rounded-[1.5rem] bg-white p-5 shadow-pop ring-1 ring-black/5">{code()}</div>
              ) : (
                <div key="pack" className="relative w-full max-w-[280px] animate-scale-in [perspective:900px]" aria-hidden>
                  <div className="relative aspect-[4/5] rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 shadow-pop ring-1 ring-black/10 [transform:rotateY(-12deg)_rotateX(4deg)]">
                    <div className="absolute inset-x-5 top-5 space-y-1.5">
                      <div className="h-2 w-2/3 rounded-full bg-amber-900/25" /><div className="h-2 w-1/2 rounded-full bg-amber-900/15" />
                    </div>
                    <Boxes className="absolute left-5 top-14 h-10 w-10 text-amber-900/20" />
                    <div className="absolute bottom-4 right-4 w-[58%] rounded-md bg-white p-2 shadow-sm">{code()}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-zinc-900/80 dark:ring-white/10" role="group" aria-label="Preview view">
              {([["code", "Barcode"], ["pack", "On a pack"]] as const).map(([id, l]) => (
                <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", view === id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white")}>{l}</button>
              ))}
            </div>
          </div>
          <ExportButtons svg={svg} name={name} widthMm={style.widthMm} onExported={(fmt) => trackDownload(user, `${f.label} ${v.ok ? v.value : ""}`, fmt)} />
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Download className="h-3.5 w-3.5" aria-hidden /> PNG at 300 DPI, {style.widthMm} mm wide. SVG is vector — best for printers and designers.</p>
          <Button variant="secondary" className="w-full" size="lg" onClick={() => setPrintOpen(true)} disabled={!svg}>
            <Printer className="h-4 w-4" /> Print labels
          </Button>
          <div className="flex flex-wrap gap-2">
            {v.ok && (
              <Link href={`/products/new?barcode=${encodeURIComponent(v.value)}&format=${format}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium transition hover:shadow-card dark:border-slate-800 dark:bg-slate-900">
                <PackagePlus className="h-3.5 w-3.5 text-brand" aria-hidden /> Save as product
              </Link>
            )}
            <Link href="/bulk?mode=barcode" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium transition hover:shadow-card dark:border-slate-800 dark:bg-slate-900"><FileSpreadsheet className="h-3.5 w-3.5 text-brand" aria-hidden /> Bulk from CSV/Excel</Link>
          </div>
          {f.id === "upce" && <Alert tone="info" icon={<Info className="h-4 w-4" />}>Only UPC-A numbers with enough zeros can be shown as UPC-E. If yours can&apos;t, use UPC-A.</Alert>}
        </div>
      </div>

      <Modal open={printOpen} onClose={() => setPrintOpen(false)} title="Print labels" description="Choose a layout and label size, then print or save a PDF." size="lg">
        <LabelDesigner barcodeSvg={svg} data={labelData} onData={(d) => setLabelData({ name: d.name || "", variant: d.variant || "", price: d.price || "", sku: d.sku || "" })}
          settings={label} onSettings={setLabel} name={name} />
      </Modal>
    </div>
  );
}
