"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Download, FileSpreadsheet, Info, PackagePlus, Printer, XCircle } from "lucide-react";
import { BARCODE_MAP, getBarcodeFormat, validateBarcode, type BarcodeFormatDef } from "@/lib/barcodes";
import { loadPrefs } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { Alert, Badge, Card, Disclosure, Field, Input, Modal, Segmented, Textarea, Button } from "@/components/ui";
import { useApp } from "@/components/providers";
import { trackDownload } from "@/components/qr/export-panel";
import {
  BarcodePreview, DEFAULT_BARCODE_STYLE, DEFAULT_LABEL, ExportButtons, GtinNotice, LabelDesigner, ScannableBadge, StyleControls, useBarcodeSvg,
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

function FormatCard({ f, selected, onClick }: { f: BarcodeFormatDef; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={cn("flex flex-col items-start justify-start rounded-lg border p-3 text-left transition-colors",
        selected ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60")}>
      <span className="flex items-center gap-1.5 text-[13px] font-medium">{f.label}{!f.scannable && <Badge tone="amber">Generate only</Badge>}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{WHEN[f.id]}</span>
    </button>
  );
}

const stepNo = (n: number) => <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">{n}</span>;

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

  const chooseKind = (k: Kind) => {
    setKind(k);
    if (kindOf(format) !== k) { setFormat(GROUPS[k].common[0]); setMoreOpen(false); }
  };

  return (
    <div className="space-y-4">
      <Segmented className="flex w-full lg:hidden [&>button]:flex-1" value={mobileView} onChange={setMobileView}
        options={[{ value: "edit", label: "Edit" }, { value: "preview", label: "Preview & download" }]} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className={cn("min-w-0 space-y-4", mobileView === "preview" && "hidden lg:block")}>
          <Card>
            <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
              {stepNo(1)}<h2 className="section-title">Choose a barcode type</h2>
              <Segmented size="sm" className="ml-auto" value={kind} onChange={chooseKind}
                options={[{ value: "product", label: "Product barcode" }, { value: "custom", label: "Custom barcode" }]} />
            </div>
            <div className="space-y-3 p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {kind === "product" ? "Numeric codes printed on retail packs, books and cartons (GTIN family)." : "Your own text or numbers — SKUs, assets, tickets, documents."}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GROUPS[kind].common.map((id) => <FormatCard key={id} f={BARCODE_MAP[id]} selected={format === id} onClick={() => setFormat(id)} />)}
              </div>
              <button type="button" onClick={() => setMoreOpen((m) => !m)} aria-expanded={moreOpen}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} aria-hidden /> {moreOpen ? "Fewer formats" : `More formats (${GROUPS[kind].more.length})`}
              </button>
              {moreOpen && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {GROUPS[kind].more.map((id) => <FormatCard key={id} f={BARCODE_MAP[id]} selected={format === id} onClick={() => setFormat(id)} />)}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
              {stepNo(2)}<h2 className="section-title">Enter the {f.label} data</h2>
              <span className="ml-auto"><ScannableBadge formatId={format} /></span>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">{f.description}</p>
              <Field label="Data to encode" htmlFor="bc-data" error={!v.ok && raw ? v.error : undefined}
                hint={v.ok ? undefined : `Example: ${f.example}`}>
                {f.dims === "2d"
                  ? <Textarea id="bc-data" rows={3} value={raw} placeholder={f.placeholder} onChange={(e) => setValues((s) => ({ ...s, [format]: e.target.value }))} invalid={!v.ok && !!raw} />
                  : <Input id="bc-data" value={raw} placeholder={f.placeholder} onChange={(e) => setValues((s) => ({ ...s, [format]: e.target.value }))} invalid={!v.ok && !!raw} className="h-11 font-mono text-base" spellCheck={false} autoComplete="off" />}
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
          </Card>
          <Button variant="outline" className="w-full lg:hidden" onClick={() => { setMobileView("preview"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Preview & download</Button>
        </div>

        <div className={cn("space-y-4 self-start lg:sticky lg:top-20", mobileView === "edit" && "hidden lg:block")}>
          <Card>
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              {stepNo(3)}<h2 className="section-title">Preview & download</h2>
              <Badge tone="violet" className="ml-auto">{f.label}</Badge>
            </div>
            <div className="space-y-4 p-5">
              <BarcodePreview svg={svg} error={error || (!v.ok && raw ? v.error : "")} className="min-h-[220px]" />
              <ExportButtons svg={svg} name={name} widthMm={style.widthMm} onExported={(fmt) => trackDownload(user, `${f.label} ${v.ok ? v.value : ""}`, fmt)} />
              <p className="flex items-center gap-1.5 text-xs text-slate-500"><Download className="h-3.5 w-3.5" aria-hidden /> PNG at 300 DPI, {style.widthMm} mm wide. SVG is vector — best for printers and designers.</p>
              <Button variant="secondary" className="w-full" size="lg" onClick={() => setPrintOpen(true)} disabled={!svg}>
                <Printer className="h-4 w-4" /> Print labels
              </Button>
            </div>
          </Card>
          <div className="grid gap-2 sm:grid-cols-2">
            {v.ok && (
              <Link href={`/products/new?barcode=${encodeURIComponent(v.value)}&format=${format}`} className="card flex items-center gap-2 p-3 text-sm font-medium hover:border-slate-300 dark:hover:border-slate-700">
                <PackagePlus className="h-4 w-4 text-brand" aria-hidden /> Save as product
              </Link>
            )}
            <Link href="/bulk?mode=barcode" className="card flex items-center gap-2 p-3 text-sm font-medium hover:border-slate-300 dark:hover:border-slate-700"><FileSpreadsheet className="h-4 w-4 text-brand" aria-hidden /> Bulk from CSV/Excel</Link>
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
