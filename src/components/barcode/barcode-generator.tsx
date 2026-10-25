"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Info, PackagePlus, Sparkles, XCircle } from "lucide-react";
import { getBarcodeFormat, validateBarcode } from "@/lib/barcodes";
import { Alert, Badge, Card, Field, Input, Tabs, Textarea } from "@/components/ui";
import { useApp } from "@/components/providers";
import { trackDownload } from "@/components/qr/export-panel";
import {
  BarcodePreview, DEFAULT_BARCODE_STYLE, DEFAULT_LABEL, ExportButtons, FormatPicker, GtinNotice, LabelDesigner, ScannableBadge, StyleControls, useBarcodeSvg,
  type BarcodeStyle, type LabelSettings,
} from "./barcode-ui";

const KEY = "qrsathi:barcode:v1";
const USE_CASES: { label: string; format: string; value: string }[] = [
  { label: "Retail product (EAN-13)", format: "ean13", value: "890123456789" },
  { label: "Inventory SKU (Code 128)", format: "code128", value: "SKU-1042-BLU-M" },
  { label: "Book (ISBN)", format: "isbn", value: "978-0-306-40615-7" },
  { label: "Carton (ITF-14)", format: "itf14", value: "1890123456789" },
  { label: "Shipping (GS1-128)", format: "gs1-128", value: "(01)18901234567897(17)271231(10)LOT42" },
  { label: "Event ticket (Aztec)", format: "aztec", value: "TICKET-2026-0042" },
];

export function BarcodeGenerator() {
  const { user } = useApp();
  const [format, setFormat] = useState("ean13");
  const [values, setValues] = useState<Record<string, string>>({});
  const [style, setStyle] = useState<BarcodeStyle>(DEFAULT_BARCODE_STYLE);
  const [label, setLabel] = useState<LabelSettings>({ ...DEFAULT_LABEL, layout: "barcode" });
  const [labelData, setLabelData] = useState({ name: "", variant: "", price: "", sku: "" });
  const [tab, setTab] = useState<"export" | "label">("export");

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s?.format && getBarcodeFormat(s.format).id === s.format) setFormat(s.format);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-6">
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-bold">1. Barcode type</h2>
          <FormatPicker value={format} onChange={setFormat} />
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500">Quick start:</span>
            {USE_CASES.map((u) => (
              <button key={u.label} type="button" onClick={() => { setFormat(u.format); setValues((s) => ({ ...s, [u.format]: u.value })); }}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">{u.label}</button>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold">2. {f.label} data</h2>
              <p className="text-sm text-slate-500">{f.description}</p>
            </div>
            <ScannableBadge formatId={format} />
          </div>
          <Field label="Data to encode" error={!v.ok && raw ? v.error : undefined}>
            {f.dims === "2d"
              ? <Textarea rows={3} value={raw} placeholder={f.placeholder} onChange={(e) => setValues((s) => ({ ...s, [format]: e.target.value }))} invalid={!v.ok && !!raw} />
              : <Input value={raw} placeholder={f.placeholder} onChange={(e) => setValues((s) => ({ ...s, [format]: e.target.value }))} invalid={!v.ok && !!raw} className="font-mono" spellCheck={false} />}
          </Field>
          {v.ok ? (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Valid {f.label}: <span className="font-mono">{v.display}</span></p>
              {v.warnings.map((w) => <p key={w} className="flex items-start gap-1.5 text-xs text-slate-500"><Info className="mt-px h-3.5 w-3.5 shrink-0" /> {w}</p>)}
            </div>
          ) : raw ? (
            <p className="flex items-center gap-1.5 text-sm text-rose-600"><XCircle className="h-4 w-4" /> Not encodable as {f.label} — fix the data or pick a compatible format.</p>
          ) : null}
          <GtinNotice formatId={format} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">3. Size & style</h2>
          <StyleControls style={style} onChange={setStyle} dims={f.dims} />
        </Card>
      </div>

      <div className="space-y-4 self-start lg:sticky lg:top-24">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Live preview</h2>
            <Badge tone="violet">{f.label}</Badge>
          </div>
          <BarcodePreview svg={svg} error={error || (!v.ok && raw ? v.error : "")} />
        </Card>
        <Card>
          <Tabs className="px-3" value={tab} onChange={setTab} tabs={[{ value: "export", label: "Download" }, { value: "label", label: "Labels & print" }]} />
          <div className="p-5">
            {tab === "export" ? (
              <div className="space-y-3">
                <ExportButtons svg={svg} name={`${f.id}-${v.ok ? v.value : "barcode"}`} widthMm={style.widthMm} onExported={(fmt) => trackDownload(user, `${f.label} ${v.ok ? v.value : ""}`, fmt)} />
                <p className="text-xs text-slate-500">PNG at 300 DPI ({style.widthMm} mm wide). SVG is vector — best for print designers.</p>
              </div>
            ) : (
              <LabelDesigner barcodeSvg={svg} data={labelData} onData={(d) => setLabelData({ name: d.name || "", variant: d.variant || "", price: d.price || "", sku: d.sku || "" })}
                settings={label} onSettings={setLabel} name={`${f.id}-${v.ok ? v.value : "barcode"}`} />
            )}
          </div>
        </Card>
        <div className="grid gap-2 sm:grid-cols-2">
          {v.ok && (
            <Link href={`/products/new?barcode=${encodeURIComponent(v.value)}&format=${format}`} className="card flex items-center gap-2 p-3 text-sm font-semibold hover:border-brand/40">
              <PackagePlus className="h-4 w-4 text-brand" /> Save as product
            </Link>
          )}
          <Link href="/bulk?mode=barcode" className="card flex items-center gap-2 p-3 text-sm font-semibold hover:border-brand/40"><FileSpreadsheet className="h-4 w-4 text-brand" /> Bulk from CSV/Excel</Link>
        </div>
        {f.id === "upce" && <Alert tone="info" icon={<Sparkles className="h-4 w-4" />}>Only UPC-A numbers with enough zeros can be shown as UPC-E. If yours can&apos;t, use UPC-A.</Alert>}
      </div>
    </div>
  );
}
