"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, Info, Printer, Tag } from "lucide-react";
import { toast } from "sonner";
import { BARCODE_GROUPS, BARCODE_FORMATS, LABEL_SIZES, getBarcodeFormat, renderBarcodeSvg, renderLabelSvg, type BarcodeRenderOptions, type LabelData, type LabelLayout } from "@/lib/barcodes";
import { downloadSvgAs, labelsPdf, mmToPx, printLabels } from "@/lib/barcode-export";
import { downloadBlob } from "@/lib/qr-export";
import { Alert, Badge, Button, ColorInput, Field, Input, Segmented, Select, Switch } from "@/components/ui";
import { cn, safeFilename } from "@/lib/utils";

export interface BarcodeStyle {
  heightMm: number;
  margin: number;
  showText: boolean;
  color: string;
  background: string; // "" = transparent
  widthMm: number; // export width
}
export const DEFAULT_BARCODE_STYLE: BarcodeStyle = { heightMm: 15, margin: 10, showText: true, color: "#000000", background: "#ffffff", widthMm: 50 };

export function toRenderOptions(s: BarcodeStyle): BarcodeRenderOptions {
  return { heightMm: s.heightMm, margin: s.margin, showText: s.showText, color: s.color, background: s.background || undefined };
}

/** Renders a barcode, returning svg or a readable error. */
export function useBarcodeSvg(format: string, value: string | null, style: BarcodeStyle) {
  return useMemo(() => {
    if (!value) return { svg: "", error: "" };
    try {
      return { svg: renderBarcodeSvg(format, value, toRenderOptions(style)), error: "" };
    } catch (e) {
      return { svg: "", error: (e as Error).message };
    }
  }, [format, value, style]);
}

export function BarcodePreview({ svg, error, placeholder = "Enter valid data to see the barcode", className }: { svg: string; error?: string; placeholder?: string; className?: string }) {
  return (
    <div className={cn("checker grid min-h-[200px] place-items-center rounded-2xl p-5", className)}>
      {svg ? (
        <div className="w-full max-w-[360px] [&>svg]:h-auto [&>svg]:max-h-[320px] [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="Barcode preview" />
      ) : (
        <p className="max-w-xs rounded-xl bg-white/95 px-4 py-3 text-center text-sm text-slate-600 shadow-sm dark:bg-slate-900/95 dark:text-slate-300">
          {error ? <span className="text-rose-600 dark:text-rose-400">{error}</span> : placeholder}
        </p>
      )}
    </div>
  );
}

export function FormatPicker({ value, onChange, only }: { value: string; onChange: (id: string) => void; only?: string[] }) {
  const list = only ? BARCODE_FORMATS.filter((f) => only.includes(f.id)) : BARCODE_FORMATS;
  return (
    <div className="space-y-3">
      {BARCODE_GROUPS.map((g) => {
        const items = list.filter((f) => f.group === g.id);
        if (!items.length) return null;
        return (
          <div key={g.id}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {items.map((f) => (
                <button key={f.id} type="button" onClick={() => onChange(f.id)} aria-pressed={f.id === value}
                  className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                    f.id === value ? "border-brand bg-brand text-white" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}>
                  {f.label}{!f.scannable && <span className="ml-1 opacity-70">*</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {list.some((f) => !f.scannable) && <p className="text-[11px] text-slate-500">* Generate only — our in-app scanner can&apos;t read these; most hardware scanners can.</p>}
    </div>
  );
}

export function StyleControls({ style, onChange, dims }: { style: BarcodeStyle; onChange: (s: BarcodeStyle) => void; dims: "1d" | "2d" }) {
  const set = <K extends keyof BarcodeStyle>(k: K, v: BarcodeStyle[K]) => onChange({ ...style, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {dims === "1d" && (
        <Field label={`Bar height: ${style.heightMm} mm`}>
          <input type="range" min={5} max={40} value={style.heightMm} onChange={(e) => set("heightMm", +e.target.value)} className="w-full accent-[hsl(var(--brand))]" />
        </Field>
      )}
      <Field label={`Quiet zone: ${style.margin}`} hint="Blank margin scanners need around the code.">
        <input type="range" min={0} max={30} value={style.margin} onChange={(e) => set("margin", +e.target.value)} className="w-full accent-[hsl(var(--brand))]" />
      </Field>
      <Field label="Export width (mm)" hint={`${mmToPx(style.widthMm)} px at 300 DPI`}>
        <Input type="number" min={10} max={400} value={style.widthMm} onChange={(e) => set("widthMm", Math.max(10, Math.min(400, +e.target.value || 10)))} />
      </Field>
      {dims === "1d" && <div className="pt-6"><Switch checked={style.showText} onChange={(v) => set("showText", v)} label="Human-readable text" /></div>}
      <ColorInput label="Bars" value={style.color} onChange={(v) => set("color", v)} />
      <div>
        <ColorInput label="Background" value={style.background || "#ffffff"} onChange={(v) => set("background", v)} />
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={!style.background} onChange={(e) => set("background", e.target.checked ? "" : "#ffffff")} /> Transparent</label>
      </div>
      {style.margin < 5 && <Alert tone="warn" className="sm:col-span-2" icon={<AlertTriangle className="h-4 w-4" />}>A small quiet zone can stop barcodes from scanning, especially 1D codes.</Alert>}
    </div>
  );
}

export function ExportButtons({ svg, name, widthMm, onExported }: { svg: string; name: string; widthMm: number; onExported?: (fmt: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (fmt: "png" | "svg" | "pdf") => {
    if (!svg) return;
    setBusy(fmt);
    try {
      const file = safeFilename(name, "barcode");
      if (fmt === "pdf") downloadBlob(await labelsPdf([{ svg }], { w: widthMm, h: widthMm }, "labels"), `${file}.pdf`);
      else await downloadSvgAs(svg, fmt, file, mmToPx(widthMm));
      onExported?.(fmt);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["png", "svg", "pdf"] as const).map((f) => (
        <Button key={f} variant={f === "png" ? "gradient" : "outline"} onClick={() => run(f)} loading={busy === f} disabled={!svg}><Download className="h-4 w-4" /> {f.toUpperCase()}</Button>
      ))}
    </div>
  );
}

export interface LabelSettings {
  layout: LabelLayout;
  sizeId: string;
  customW: number;
  customH: number;
  copies: number;
  sheet: "labels" | "a4";
}
export const DEFAULT_LABEL: LabelSettings = { layout: "product", sizeId: "50x25", customW: 50, customH: 25, copies: 1, sheet: "labels" };

export function labelSize(s: LabelSettings) {
  const preset = LABEL_SIZES.find((x) => x.id === s.sizeId);
  return preset ? { w: preset.w, h: preset.h } : { w: s.customW, h: s.customH };
}

/** Label layout + size + copies, with live preview, PDF and direct print. */
export function LabelDesigner({ barcodeSvg, data, onData, settings, onSettings, name, extraLabels }: {
  barcodeSvg: string; data: LabelData; onData?: (d: LabelData) => void; settings: LabelSettings; onSettings: (s: LabelSettings) => void; name: string;
  /** Additional labels (e.g. other selected products) printed after this one. */
  extraLabels?: string[];
}) {
  const size = labelSize(settings);
  const label = useMemo(() => (barcodeSvg ? renderLabelSvg(barcodeSvg, settings.layout, size, data) : ""), [barcodeSvg, settings.layout, size.w, size.h, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof LabelSettings>(k: K, v: LabelSettings[K]) => onSettings({ ...settings, [k]: v });
  const [busy, setBusy] = useState(false);
  const all = () => [...Array(Math.max(1, settings.copies)).fill(label), ...(extraLabels || [])];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Layout">
          <Select value={settings.layout} onChange={(e) => set("layout", e.target.value as LabelLayout)}>
            <option value="product">Product label (name, price, SKU)</option>
            <option value="shelf">Shelf label (large price)</option>
            <option value="compact">Compact sticker (name + code)</option>
            <option value="barcode">Barcode only</option>
          </Select>
        </Field>
        <Field label="Label size">
          <Select value={settings.sizeId} onChange={(e) => set("sizeId", e.target.value)}>
            {LABEL_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            <option value="custom">Custom…</option>
          </Select>
        </Field>
        {settings.sizeId === "custom" && (
          <>
            <Field label="Width (mm)"><Input type="number" min={20} max={200} value={settings.customW} onChange={(e) => set("customW", Math.max(20, Math.min(200, +e.target.value || 20)))} /></Field>
            <Field label="Height (mm)"><Input type="number" min={10} max={200} value={settings.customH} onChange={(e) => set("customH", Math.max(10, Math.min(200, +e.target.value || 10)))} /></Field>
          </>
        )}
        {onData && settings.layout !== "barcode" && (
          <>
            <Field label="Title"><Input value={data.name || ""} maxLength={60} onChange={(e) => onData({ ...data, name: e.target.value })} /></Field>
            {settings.layout === "product" && <Field label="Subtitle / variant"><Input value={data.variant || ""} maxLength={60} onChange={(e) => onData({ ...data, variant: e.target.value })} /></Field>}
            {settings.layout !== "compact" && <Field label="Price text"><Input value={data.price || ""} maxLength={20} placeholder="₹ 199.00" onChange={(e) => onData({ ...data, price: e.target.value })} /></Field>}
            {settings.layout === "product" && <Field label="SKU text"><Input value={data.sku || ""} maxLength={30} onChange={(e) => onData({ ...data, sku: e.target.value })} /></Field>}
          </>
        )}
        <Field label="Copies"><Input type="number" min={1} max={500} value={settings.copies} onChange={(e) => set("copies", Math.max(1, Math.min(500, +e.target.value || 1)))} /></Field>
        <Field label="Print on">
          <Segmented size="sm" value={settings.sheet} onChange={(v) => set("sheet", v)} options={[{ value: "labels", label: "Label roll" }, { value: "a4", label: "A4 sheet" }]} />
        </Field>
      </div>
      <div className="grid place-items-center rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
        {label ? <div className="w-full max-w-[320px] bg-white shadow-md [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: label }} /> : <p className="text-sm text-slate-500">No barcode yet</p>}
        <p className="mt-2 text-xs text-slate-500"><Tag className="mr-1 inline h-3 w-3" />{size.w} × {size.h} mm{extraLabels?.length ? ` · +${extraLabels.length} more labels` : ""}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => printLabels(all(), size, settings.sheet)} disabled={!label}><Printer className="h-4 w-4" /> Print</Button>
        <Button variant="outline" disabled={!label} loading={busy} onClick={async () => {
          setBusy(true);
          try { downloadBlob(await labelsPdf(all().map((svg) => ({ svg })), size, settings.sheet), `${safeFilename(name, "labels")}-labels.pdf`); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}><Download className="h-4 w-4" /> PDF</Button>
        <Button variant="outline" disabled={!label} onClick={() => downloadSvgAs(label, "png", `${safeFilename(name, "label")}-label`, mmToPx(size.w))}><Download className="h-4 w-4" /> PNG</Button>
      </div>
      <p className="flex gap-1.5 text-[11px] text-slate-500"><Info className="mt-px h-3 w-3 shrink-0" /> For thermal printers choose “Label roll” and set the printer&apos;s paper size to {size.w} × {size.h} mm with margins “None”. Print at 100% scale.</p>
    </div>
  );
}

export function GtinNotice({ formatId, className }: { formatId: string; className?: string }) {
  const f = getBarcodeFormat(formatId);
  if (!f.gtinLike && !["gs1-128", "gs1datamatrix", "gs1qr"].includes(formatId)) return null;
  return (
    <Alert tone="warn" className={className} icon={<AlertTriangle className="h-4 w-4" />} title="Official retail barcodes (GTINs)">
      Products sold through retailers and marketplaces need GTINs legitimately allocated to your company by <strong>GS1 India</strong> (or your country&apos;s GS1 organisation). QRSathi never assigns official GTINs. Internal numbers we generate use the restricted-circulation prefix 2 (20–29) and are only for use inside your own shop or warehouse.
    </Alert>
  );
}

export function ScannableBadge({ formatId }: { formatId: string }) {
  const f = getBarcodeFormat(formatId);
  return f.scannable ? <Badge tone="green">Scannable in app</Badge> : <Badge tone="amber">Generate only</Badge>;
}
