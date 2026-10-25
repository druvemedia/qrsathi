"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileArchive, FileDown, FileSpreadsheet, Printer, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BARCODE_MAP, getBarcodeFormat, renderBarcodeSvg, renderLabelSvg, validateBarcode } from "@/lib/barcodes";
import { buildZip, downloadBlob, svgBlob, svgToPngBlob } from "@/lib/qr-export";
import { labelsPdf, mmToPx, printLabels } from "@/lib/barcode-export";
import { parseTableFile, toCsv } from "@/lib/table-file";
import { GUEST_BULK_ROWS } from "@/lib/plans";
import { safeFilename, cn } from "@/lib/utils";
import { Alert, Badge, Button, Card, Field, Segmented, Select, Stepper } from "@/components/ui";
import { useApp } from "@/components/providers";
import { trackDownload } from "@/components/qr/export-panel";
import { DEFAULT_BARCODE_STYLE, DEFAULT_LABEL, FormatPicker, GtinNotice, LabelDesigner, StyleControls, labelSize, toRenderOptions, type BarcodeStyle, type LabelSettings } from "@/components/barcode/barcode-ui";

const NONE = "";

interface Row { index: number; filename: string; value?: string; error?: string; name: string; price: string; sku: string }

export function BarcodeBulk() {
  const { user } = useApp();
  const limit = user ? user.limits.bulkRows : GUEST_BULK_ROWS;
  const [format, setFormat] = useState("code128");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [map, setMap] = useState({ value: NONE, filename: NONE, name: NONE, price: NONE, sku: NONE });
  const [style, setStyle] = useState<BarcodeStyle>(DEFAULT_BARCODE_STYLE);
  const [label, setLabel] = useState<LabelSettings>({ ...DEFAULT_LABEL, layout: "product" });
  const [output, setOutput] = useState<"png" | "svg" | "both">("png");
  const [what, setWhat] = useState<"barcodes" | "labels">("barcodes");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string; count: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "ok" | "error">("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const f = getBarcodeFormat(format);

  const pick = async (file: File) => {
    try {
      const t = await parseTableFile(file);
      setHeaders(t.headers);
      setRows(t.rows);
      setFileName(file.name);
      setResult(null);
      const find = (re: RegExp) => t.headers.find((h) => re.test(h.trim())) ?? NONE;
      setMap({
        value: find(/^(barcode|code|value|ean|upc|gtin|isbn|data|sku)$/i) || t.headers[0],
        filename: find(/^(file ?name|filename)$/i), name: find(/^(name|product|title|product ?name)$/i), price: find(/^(price|mrp|rate)$/i), sku: find(/^sku$/i),
      });
      if (t.rows.length > limit) toast.warning(`Only the first ${limit} rows will be processed on your plan.`);
      else toast.success(`Loaded ${t.rows.length} rows`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const col = (r: string[], h: string) => (h ? String(r[headers.indexOf(h)] ?? "").trim() : "");
  const processed: Row[] = useMemo(() => rows.slice(0, limit).map((r, i) => {
    const raw = col(r, map.value);
    const name = col(r, map.name), price = col(r, map.price), sku = col(r, map.sku);
    const filename = safeFilename(col(r, map.filename) || sku || name || raw || `${format}-${i + 1}`);
    if (!raw) return { index: i + 1, filename, name, price, sku, error: "Empty value" };
    // Never change the data silently: invalid rows are reported, not corrected.
    const v = validateBarcode(format, raw);
    if (!v.ok) return { index: i + 1, filename, name, price, sku, error: v.error };
    return { index: i + 1, filename, name, price, sku, value: v.value };
  }), [rows, map, format, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const good = processed.filter((r) => r.value);
  const bad = processed.filter((r) => r.error);
  const shown = processed.filter((r) => (filter === "ok" ? r.value : filter === "error" ? r.error : true));
  const report = () => toCsv(["row", "filename", "status", "error", "encoded_value"], processed.map((r) => [r.index, r.filename, r.value ? "ok" : "error", r.error || "", r.value || ""]));

  const svgFor = (r: Row) => {
    const svg = renderBarcodeSvg(format, r.value!, toRenderOptions(style));
    return what === "labels" ? renderLabelSvg(svg, label.layout, labelSize(label), { name: r.name, price: r.price, sku: r.sku }) : svg;
  };
  const widthPx = what === "labels" ? mmToPx(labelSize(label).w) : mmToPx(style.widthMm);

  const zip = async () => {
    setProgress(0);
    const files: { name: string; blob: Blob }[] = [];
    const failed: string[][] = [];
    for (let i = 0; i < good.length; i++) {
      const r = good[i];
      try {
        const svg = svgFor(r);
        if (output !== "svg") files.push({ name: `${r.filename}.png`, blob: await svgToPngBlob(svg, widthPx) });
        if (output !== "png") files.push({ name: `${r.filename}.svg`, blob: svgBlob(svg) });
      } catch (e) {
        failed.push([String(r.index), r.filename, "error", (e as Error).message, r.value!]);
      }
      if (i % 5 === 0) setProgress(Math.round(((i + 1) / good.length) * 100));
    }
    files.push({ name: "report.csv", blob: new Blob([report() + (failed.length ? "\n" + toCsv([], failed).slice(1) : "")], { type: "text/csv" }) });
    const zipBlob = await buildZip(files);
      const zipName = `${safeFilename(fileName.replace(/\.[^.]+$/, "") || "barcodes")}-${format}.zip`;
      downloadBlob(zipBlob, zipName);
      setResult({ blob: zipBlob, name: zipName, count: good.length });
    trackDownload(user, `Bulk ${f.label}: ${good.length}`, "zip");
    setProgress(null);
    toast.success(`ZIP ready — ${good.length} ${what}${bad.length ? `, ${bad.length} rows skipped (see report.csv)` : ""}`);
  };

  const pdf = async () => {
    setProgress(0);
    try {
      const size = what === "labels" ? labelSize(label) : { w: style.widthMm, h: style.widthMm };
      downloadBlob(await labelsPdf(good.map((r) => ({ svg: svgFor(r), label: what === "barcodes" ? r.filename : undefined })), size, what === "labels" ? label.sheet : "a4"), `${format}-${what}.pdf`);
      trackDownload(user, `Bulk PDF ${f.label}: ${good.length}`, "pdf");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const sample = processed.find((r) => r.value);
  const sampleBarcode = useMemo(() => { try { return sample ? renderBarcodeSvg(format, sample.value!, toRenderOptions(style)) : ""; } catch { return ""; } }, [sample, format, style]);

  const step = !headers.length ? 0 : progress !== null ? 4 : result ? 5 : processed.length ? (bad.length ? 2 : 3) : 1;
  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <Stepper steps={["Upload", "Map columns", "Validate", "Preview", "Generate", "Download"]} current={step} />
        <p className="text-xs text-slate-500">File requirements: .csv or .xlsx, first row = column headers, one code per row. Invalid rows are reported and skipped — values are never changed silently.</p>
      </Card>
      {result && progress === null && (
        <Alert tone="success" title={`Done — ${result.count} files generated`}>
          Your download started automatically. <button className="font-medium underline" onClick={() => downloadBlob(result.blob, result.name)}>Download {result.name} again</button>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step 1</p>
          <h2 className="mb-3 font-display text-lg font-bold">Barcode format</h2>
          <FormatPicker value={format} onChange={setFormat} />
          <GtinNotice formatId={format} className="mt-4" />
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step 2</p>
          <h2 className="font-display text-lg font-bold">Upload CSV or Excel</h2>
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-5 text-center dark:border-slate-800"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) pick(file); }}>
            <FileSpreadsheet className="h-9 w-9 text-slate-300" />
            <p className="text-sm font-semibold">{fileName || "Drop a .csv or .xlsx file"}</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) pick(file); e.target.value = ""; }} />
            <Button size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Choose file</Button>
            <p className="text-xs text-slate-500">{user ? `Up to ${limit.toLocaleString("en-IN")} rows on your plan.` : <>Guests: {GUEST_BULK_ROWS} rows. <Link href="/signup" className="text-brand underline">Sign up</Link> for more.</>}</p>
            <button className="text-xs font-semibold text-brand" onClick={() => downloadBlob(new Blob([toCsv(["filename", "barcode", "name", "price", "sku"], [["item-1", f.example, "Sample product", "₹ 99", "SKU-1"]])], { type: "text/csv" }), `${format}-template.csv`)}>
              <FileDown className="mr-1 inline h-3.5 w-3.5" />Template CSV
            </button>
          </div>
        </Card>
      </div>

      {headers.length > 0 && (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step 3</p>
          <h2 className="mb-4 font-display text-lg font-bold">Map columns & style</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {([["value", `${f.label} data *`], ["filename", "File name"], ["name", "Label title"], ["price", "Label price"], ["sku", "Label SKU"]] as const).map(([k, lbl]) => (
              <Field key={k} label={lbl}>
                <Select value={map[k]} onChange={(e) => setMap({ ...map, [k]: e.target.value })}>
                  <option value={NONE}>{k === "value" ? "— choose —" : "— not used —"}</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </Field>
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <Segmented value={what} onChange={setWhat} options={[{ value: "barcodes", label: "Plain barcodes" }, { value: "labels", label: "Printable labels" }]} />
              <div className="mt-4">
                {what === "barcodes"
                  ? <StyleControls style={style} onChange={setStyle} dims={f.dims} />
                  : <LabelDesigner barcodeSvg={sampleBarcode} data={{ name: sample?.name, price: sample?.price, sku: sample?.sku }} settings={label} onSettings={setLabel} name="bulk-labels"
                      extraLabels={good.slice(1).flatMap((r) => { try { return Array(Math.max(1, label.copies)).fill(svgFor(r)); } catch { return []; } })} />}
              </div>
            </div>
            {what === "barcodes" && (
              <div className="checker grid place-items-center rounded-2xl p-5">
                {sampleBarcode ? <div className="w-full max-w-[320px] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: sampleBarcode }} /> : <p className="text-sm text-slate-500">No valid row to preview</p>}
              </div>
            )}
          </div>
        </Card>
      )}

      {processed.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step 4</p>
              <h2 className="font-display text-lg font-bold">Validate & generate</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> {good.length} valid</Badge>
                {bad.length > 0 && <Badge tone="rose"><XCircle className="h-3 w-3" /> {bad.length} invalid</Badge>}
                {rows.length > limit && <Badge tone="amber">{rows.length - limit} over plan limit</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented size="sm" value={output} onChange={setOutput} options={[{ value: "png", label: "PNG" }, { value: "svg", label: "SVG" }, { value: "both", label: "Both" }]} />
              <Button variant="outline" size="sm" onClick={() => downloadBlob(new Blob([report()], { type: "text/csv" }), `${format}-report.csv`)}><FileDown className="h-4 w-4" /> Report</Button>
              <Button variant="outline" size="sm" onClick={pdf} disabled={!good.length || progress !== null}><Printer className="h-4 w-4" /> PDF</Button>
              {what === "labels" && <Button variant="outline" size="sm" disabled={!good.length} onClick={() => printLabels(good.flatMap((r) => Array(Math.max(1, label.copies)).fill(svgFor(r))), labelSize(label), label.sheet)}><Printer className="h-4 w-4" /> Print</Button>}
              <Button variant="gradient" onClick={zip} loading={progress !== null} disabled={!good.length}><FileArchive className="h-4 w-4" /> {progress !== null ? `${progress}%` : `ZIP (${good.length})`}</Button>
            </div>
          </div>
          {progress !== null && <div className="h-1 bg-slate-100 dark:bg-slate-800"><div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>}
          <div className="border-t border-slate-100 px-5 py-2 dark:border-slate-800">
            <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: `All (${processed.length})` }, { value: "ok", label: "Valid" }, { value: "error", label: "Errors" }]} />
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-2.5">#</th><th className="px-3 py-2.5">File name</th><th className="px-3 py-2.5">Encoded value / error</th><th className="px-5 py-2.5 text-right" /></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shown.slice(0, 300).map((r) => (
                  <tr key={r.index} className={cn(r.error && "bg-rose-50/50 dark:bg-rose-500/5")}>
                    <td className="px-5 py-2 text-slate-400">{r.index}</td>
                    <td className="px-3 py-2 font-medium">{r.filename}</td>
                    <td className="px-3 py-2">{r.error ? <span className="text-rose-600 dark:text-rose-400">{r.error}</span> : <span className="font-mono text-xs">{r.value}</span>}</td>
                    <td className="px-5 py-2 text-right">{r.value && (
                      <Button size="sm" variant="ghost" aria-label={`Download ${r.filename}`} onClick={async () => downloadBlob(await svgToPngBlob(svgFor(r), widthPx), `${r.filename}.png`)}><Download className="h-4 w-4" /></Button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 300 && <p className="p-4 text-center text-xs text-slate-500">Showing 300 of {shown.length} rows — all are included in downloads.</p>}
          </div>
        </Card>
      )}
      {!headers.length && <p className="text-center text-xs text-slate-500">Supports {Object.values(BARCODE_MAP).map((x) => x.label).join(", ")}.</p>}
    </div>
  );
}
