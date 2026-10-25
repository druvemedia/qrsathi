"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileArchive, FileDown, FileSpreadsheet, Palette, Printer, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { QR_TYPES, getType, validateContent, type FieldDef, type QrTypeDef } from "@/lib/qr-types";
import { DEFAULT_DESIGN, renderQr, type QrDesign } from "@/lib/qr-render";
import { buildPdf, buildZip, downloadBlob, exportSvg } from "@/lib/qr-export";
import { GUEST_BULK_ROWS, getPlan } from "@/lib/plans";
import { safeFilename, truncate, cn } from "@/lib/utils";
import { Alert, Badge, Button, Card, Field, Input, Modal, Segmented, Select } from "@/components/ui";
import { useApp } from "@/components/providers";
import { DesignPanel } from "@/components/qr/design-panel";
import { QrThumb } from "@/components/qr/preview";
import { trackDownload } from "@/components/qr/export-panel";

// Types whose content fits a flat spreadsheet row (no hosted pages / repeating lists).
const BULK_TYPES = QR_TYPES.filter((t) => !t.hosted && !t.forceDynamic && !t.fields.some((f) => f.kind === "list"));
const FIXED = "__fixed__";
const MAX_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 } as const;
const NONE = "";

const csvCell = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function bulkFields(t: QrTypeDef) {
  return t.fields.filter((f) => f.kind !== "file");
}

function coerce(f: FieldDef, raw: string): unknown {
  const v = raw ?? "";
  if (f.kind === "checkbox") return /^(true|yes|y|1)$/i.test(v.trim());
  if (f.kind === "select" && f.options) {
    // Case-insensitive match onto the allowed option values (e.g. "wpa" -> "WPA").
    const hit = f.options.find((o) => o.value.toLowerCase() === v.trim().toLowerCase() || o.label.toLowerCase() === v.trim().toLowerCase());
    return hit ? hit.value : v.trim() || f.options[0].value;
  }
  return v;
}

interface Row {
  index: number;
  filename: string;
  data: Record<string, unknown>;
  payload?: string;
  error?: string;
}

export function BulkTool() {
  const sp = useSearchParams();
  const { user } = useApp();
  const limit = user ? getPlan(user.plan).bulkRows : GUEST_BULK_ROWS;
  const [typeId, setTypeId] = useState(() => (BULK_TYPES.some((t) => t.id === sp.get("type")) ? sp.get("type")! : "url"));
  const type = getType(typeId);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fixed, setFixed] = useState<Record<string, string>>({});
  const [nameCol, setNameCol] = useState(NONE);
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);
  const [designOpen, setDesignOpen] = useState(false);
  const [format, setFormat] = useState<"png" | "svg" | "both">("png");
  const [size, setSize] = useState(1024);
  const [progress, setProgress] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "ok" | "error">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const autoMap = (hdrs: string[], t: QrTypeDef) => {
    const m: Record<string, string> = {};
    for (const f of bulkFields(t)) {
      const hit = hdrs.find((h) => [norm(f.name), norm(f.label)].includes(norm(h))) ||
        hdrs.find((h) => norm(f.label).startsWith(norm(h)) || norm(h).startsWith(norm(f.name)));
      m[f.name] = hit ?? (f.kind === "select" || f.kind === "checkbox" ? FIXED : NONE);
    }
    setMapping(m);
    setFixed(Object.fromEntries(bulkFields(t).filter((f) => f.kind === "select").map((f) => [f.name, f.options![0].value])));
    setNameCol(hdrs.find((h) => /^(file ?name|name|label|title|id)$/i.test(h.trim())) ?? NONE);
  };

  const parseFile = async (file: File) => {
    try {
      let table: string[][];
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files aren't supported — save as .xlsx or CSV.");
        const readXlsx = (await import("read-excel-file")).default;
        const data = await readXlsx(file);
        table = data.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 16) : c == null ? "" : String(c))));
      } else {
        const Papa = (await import("papaparse")).default;
        table = await new Promise<string[][]>((resolve, reject) =>
          Papa.parse<string[]>(file, { skipEmptyLines: "greedy", complete: (r) => resolve(r.data), error: reject }),
        );
      }
      if (table.length < 2) throw new Error("The file needs a header row and at least one data row.");
      const hdrs = table[0].map((h, i) => (h || `Column ${i + 1}`).trim());
      const body = table.slice(1).filter((r) => r.some((c) => String(c).trim()));
      setHeaders(hdrs);
      setRows(body);
      setFileName(file.name);
      autoMap(hdrs, type);
      if (body.length > limit) toast.warning(`Only the first ${limit} rows will be processed on your plan.`);
      else toast.success(`Loaded ${body.length} rows`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  const changeType = (id: string) => {
    setTypeId(id);
    if (headers.length) autoMap(headers, getType(id));
  };

  const processed: Row[] = useMemo(() => {
    const fields = bulkFields(type);
    return rows.slice(0, limit).map((r, i) => {
      const data: Record<string, unknown> = { ...type.defaults };
      for (const f of fields) {
        const col = mapping[f.name];
        const raw = col === FIXED ? fixed[f.name] ?? "" : col ? String(r[headers.indexOf(col)] ?? "") : "";
        data[f.name] = coerce(f, raw);
      }
      const label = nameCol ? String(r[headers.indexOf(nameCol)] ?? "").trim() : "";
      const filename = safeFilename(label || `${type.id}-${i + 1}`);
      const v = validateContent(type, data);
      if (!v.ok) {
        const [k, msg] = Object.entries(v.errors)[0];
        const f = fields.find((x) => x.name === k.split(".")[0]);
        return { index: i + 1, filename, data, error: `${f?.label ?? k}: ${msg}` };
      }
      const payload = type.build(v.data, { hostedUrl: "" });
      // Cheap capacity check (byte mode, version 40) instead of encoding every row on each change.
      const ecc = design.logo ? "H" : design.ecc;
      if (new TextEncoder().encode(payload).length > MAX_BYTES[ecc])
        return { index: i + 1, filename, data, error: `Content too long for one QR code (max ${MAX_BYTES[ecc]} bytes at level ${ecc})` };
      return { index: i + 1, filename, data: v.data!, payload };
    });
  }, [rows, headers, mapping, fixed, nameCol, type, limit, design.ecc, design.logo]);

  const good = processed.filter((r) => r.payload);
  const bad = processed.filter((r) => r.error);
  const shown = processed.filter((r) => (filter === "ok" ? r.payload : filter === "error" ? r.error : true));

  const reportCsv = () =>
    [["row", "filename", "status", "error", "encoded_content"].join(","),
      ...processed.map((r) => [String(r.index), r.filename, r.payload ? "ok" : "error", r.error || "", r.payload || ""].map(csvCell).join(","))].join("\n");

  const downloadTemplate = () => {
    const fields = bulkFields(type);
    const head = ["filename", ...fields.map((f) => f.name)];
    const sample = ["example-1", ...fields.map((f) => (f.kind === "select" ? f.options![0].value : f.kind === "checkbox" ? "false" : f.placeholder?.replace(/^Optional,? ?(e\.g\. )?/i, "") || ""))];
    downloadBlob(new Blob([head.join(",") + "\n" + sample.map(csvCell).join(",") + "\n"], { type: "text/csv" }), `${type.id}-template.csv`);
  };

  const generateZip = async () => {
    if (!good.length) return toast.error("No valid rows to generate.");
    setProgress(0);
    try {
      const files: { name: string; blob: Blob }[] = [];
      const failed: string[] = [];
      for (let i = 0; i < good.length; i++) {
        const r = good[i];
        try {
          const { svg } = renderQr(r.payload!, design, { idPrefix: `b${i}` });
          if (format !== "svg") files.push({ name: `${r.filename}.png`, blob: await exportSvg(svg, "png", size) });
          if (format !== "png") files.push({ name: `${r.filename}.svg`, blob: await exportSvg(svg, "svg", size) });
        } catch (e) {
          failed.push([String(r.index), r.filename, "error", e instanceof Error ? e.message : "render failed", r.payload!].map(csvCell).join(","));
        }
        if (i % 5 === 0) setProgress(Math.round(((i + 1) / good.length) * 100));
      }
      files.push({ name: "report.csv", blob: new Blob([[reportCsv(), ...failed].join("\n")], { type: "text/csv" }) });
      setProgress(100);
      downloadBlob(await buildZip(files), `${safeFilename(fileName.replace(/\.[^.]+$/, "") || "bulk")}-qr-codes.zip`);
      trackDownload(user, `Bulk: ${good.length} ${type.label} QR codes`, "zip");
      toast.success(`ZIP ready — ${good.length} QR codes${bad.length ? `, ${bad.length} rows skipped (see report.csv)` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setProgress(null);
    }
  };

  const generatePdf = async () => {
    if (!good.length) return;
    setProgress(0);
    try {
      const items = good.map((r, i) => ({ svg: renderQr(r.payload!, design, { idPrefix: `p${i}` }).svg, label: r.filename }));
      downloadBlob(await buildPdf(items, { paper: "a4", sizeMm: 45, layout: "grid" }), "qr-codes-sheet.pdf");
      trackDownload(user, `Bulk PDF: ${good.length} QR codes`, "pdf");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setProgress(null);
    }
  };

  const downloadOne = async (r: Row) => {
    const { svg } = renderQr(r.payload!, design, { idPrefix: "one" });
    downloadBlob(await exportSvg(svg, format === "svg" ? "svg" : "png", size), `${r.filename}.${format === "svg" ? "svg" : "png"}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step 1</p>
          <h2 className="font-display text-lg font-bold">QR type</h2>
          <Select className="mt-3" value={typeId} onChange={(e) => changeType(e.target.value)}>
            {BULK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
          <button onClick={downloadTemplate} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><FileDown className="h-4 w-4" /> Download CSV template</button>
          {type.id === "upi" && <Alert tone="info" className="mt-3">Payment details are encoded exactly as written in your file — rows with invalid UPI IDs or amounts are reported, never auto-corrected.</Alert>}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step 2</p>
          <h2 className="font-display text-lg font-bold">Upload CSV or Excel</h2>
          <div className="mt-3 flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}>
            <FileSpreadsheet className="h-10 w-10 text-slate-300" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{fileName || "Drop a .csv or .xlsx file here"}</p>
              <p className="text-xs text-slate-500">First row must contain column headers. {user ? `Your plan: up to ${limit.toLocaleString("en-IN")} rows.` : <>Guests: up to {GUEST_BULK_ROWS} rows. <Link href="/signup" className="text-brand underline">Sign up</Link> for 100+.</>}</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; }} />
            <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Choose file</Button>
          </div>
        </Card>
      </div>

      {headers.length > 0 && (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step 3</p>
          <h2 className="font-display text-lg font-bold">Map columns</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="File name / label">
              <Select value={nameCol} onChange={(e) => setNameCol(e.target.value)}>
                <option value={NONE}>— numbered automatically —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </Field>
            {bulkFields(type).map((f) => (
              <Field key={f.name} label={<>{f.label}{f.required && <span className="text-rose-500"> *</span>}</>}>
                <Select value={mapping[f.name] ?? NONE} onChange={(e) => setMapping({ ...mapping, [f.name]: e.target.value })}>
                  <option value={NONE}>— not used —</option>
                  <option value={FIXED}>Same value for every row…</option>
                  {headers.map((h) => <option key={h} value={h}>Column: {h}</option>)}
                </Select>
                {mapping[f.name] === FIXED && (
                  f.kind === "select" ? (
                    <Select className="mt-2" value={fixed[f.name] ?? ""} onChange={(e) => setFixed({ ...fixed, [f.name]: e.target.value })}>
                      {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : f.kind === "checkbox" ? (
                    <Select className="mt-2" value={fixed[f.name] ?? "false"} onChange={(e) => setFixed({ ...fixed, [f.name]: e.target.value })}>
                      <option value="false">No</option><option value="true">Yes</option>
                    </Select>
                  ) : (
                    <Input className="mt-2" value={fixed[f.name] ?? ""} placeholder={f.placeholder} onChange={(e) => setFixed({ ...fixed, [f.name]: e.target.value })} />
                  )
                )}
              </Field>
            ))}
          </div>
        </Card>
      )}

      {processed.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">Step 4</p>
              <h2 className="font-display text-lg font-bold">Preview & generate</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> {good.length} valid</Badge>
                {bad.length > 0 && <Badge tone="rose"><XCircle className="h-3 w-3" /> {bad.length} with errors</Badge>}
                {rows.length > limit && <Badge tone="amber">{rows.length - limit} rows over plan limit</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Segmented size="sm" value={format} onChange={setFormat} options={[{ value: "png", label: "PNG" }, { value: "svg", label: "SVG" }, { value: "both", label: "Both" }]} />
              {format !== "svg" && (
                <Select className="w-auto py-1.5 text-xs" value={size} onChange={(e) => setSize(+e.target.value)}>
                  <option value={512}>512 px</option><option value={1024}>1024 px</option><option value={2048}>2048 px</option>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={() => setDesignOpen(true)}><Palette className="h-4 w-4" /> Design</Button>
              <Button variant="outline" size="sm" onClick={() => downloadBlob(new Blob([reportCsv()], { type: "text/csv" }), "bulk-report.csv")}><FileDown className="h-4 w-4" /> Report</Button>
              <Button variant="outline" size="sm" onClick={generatePdf} disabled={!good.length || progress !== null}><Printer className="h-4 w-4" /> PDF sheet</Button>
              <Button variant="gradient" onClick={generateZip} loading={progress !== null} disabled={!good.length}><FileArchive className="h-4 w-4" /> {progress !== null ? `${progress}%` : `Download ZIP (${good.length})`}</Button>
            </div>
          </div>
          {progress !== null && <div className="h-1 bg-slate-100 dark:bg-slate-800"><div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>}
          <div className="border-t border-slate-100 px-5 py-2 dark:border-slate-800">
            <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: `All (${processed.length})` }, { value: "ok", label: "Valid" }, { value: "error", label: "Errors" }]} />
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                <tr><th className="px-5 py-2.5">#</th><th className="px-3 py-2.5">QR</th><th className="px-3 py-2.5">File name</th><th className="px-3 py-2.5">Content / error</th><th className="px-5 py-2.5 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shown.slice(0, 300).map((r) => (
                  <tr key={r.index} className={cn(r.error && "bg-rose-50/50 dark:bg-rose-500/5")}>
                    <td className="px-5 py-2 text-slate-400">{r.index}</td>
                    <td className="px-3 py-2">{r.payload && r.index <= 60 ? <QrThumb payload={r.payload} design={design} className="h-12 w-12" /> : r.payload ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-rose-500" />}</td>
                    <td className="px-3 py-2 font-medium">{r.filename}</td>
                    <td className="max-w-md px-3 py-2">{r.error ? <span className="text-rose-600 dark:text-rose-400">{r.error}</span> : <span className="font-mono text-xs text-slate-500">{truncate(r.payload!.replace(/\n/g, " ⏎ "), 90)}</span>}</td>
                    <td className="px-5 py-2 text-right">{r.payload && <Button size="sm" variant="ghost" onClick={() => downloadOne(r)} aria-label={`Download ${r.filename}`}><Download className="h-4 w-4" /></Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 300 && <p className="p-4 text-center text-xs text-slate-500">Showing the first 300 rows in the table — all {shown.length} are included in the download.</p>}
          </div>
        </Card>
      )}

      <Modal open={designOpen} onClose={() => setDesignOpen(false)} title="Design for all QR codes" size="lg" footer={<Button onClick={() => setDesignOpen(false)}>Done</Button>}>
        <div className="grid gap-6 md:grid-cols-[1fr_200px]">
          <DesignPanel design={design} onChange={setDesign} compact />
          <div className="md:sticky md:top-20 md:self-start">
            <QrThumb payload={good[0]?.payload || "https://example.com"} design={design} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800" />
            <p className="mt-2 text-center text-xs text-slate-500">Preview of row {good[0]?.index ?? 1}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
