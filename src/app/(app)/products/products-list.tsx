"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Barcode, FileDown, FileUp, Package, PackagePlus, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import type { ProductDto } from "@/lib/products";
import { BARCODE_MAP, renderBarcodeSvg, renderLabelSvg } from "@/lib/barcodes";
import { api } from "@/lib/fetcher";
import { downloadBlob } from "@/lib/qr-export";
import { headerKey, parseTableFile, toCsv, toXlsx } from "@/lib/table-file";
import { Alert, Badge, Button, Card, EmptyState, Input, LinkButton, Modal, Segmented, Select, Skeleton } from "@/components/ui";
import { DEFAULT_BARCODE_STYLE, DEFAULT_LABEL, LabelDesigner, labelSize, toRenderOptions, type LabelSettings } from "@/components/barcode/barcode-ui";
import { cn } from "@/lib/utils";

const EXPORT_HEADERS = ["name", "sku", "product_id", "brand", "category", "variant", "price", "currency", "stock", "low_stock_at", "batch", "expiry_date", "manufacturer", "description", "image_url", "barcode", "barcode_format", "barcode_source", "status"];
const money = (p: ProductDto) => new Intl.NumberFormat("en-IN", { style: "currency", currency: p.currency }).format(p.priceMinor / 100);

function labelFor(p: ProductDto, settings: LabelSettings) {
  const b = p.barcodes[0];
  if (!b) return "";
  try {
    const svg = renderBarcodeSvg(b.format, b.value, toRenderOptions(DEFAULT_BARCODE_STYLE));
    return renderLabelSvg(svg, settings.layout, labelSize(settings), { name: p.name, variant: p.variant, price: p.priceMinor ? money(p) : "", sku: p.sku });
  } catch {
    return "";
  }
}

export function ProductsList() {
  const sp = useSearchParams();
  const [items, setItems] = useState<ProductDto[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [lowOnly, setLowOnly] = useState(sp.get("low") === "1");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ q: dq, category, status, ...(lowOnly ? { lowStock: "1" } : {}) });
    api<{ items: ProductDto[]; categories: string[] }>(`/api/products?${qs}`)
      .then((r) => { setItems(r.items); setCategories(r.categories); })
      .catch((e) => toast.error(e.message));
  }, [dq, category, status, lowOnly]);
  useEffect(load, [load]);

  const lowCount = items?.filter((p) => p.lowStock).length ?? 0;
  const sel = useMemo(() => (items || []).filter((p) => selected.has(p.id)), [items, selected]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportRows = (list: ProductDto[]) => list.map((p) => {
    const b = p.barcodes[0];
    return [p.name, p.sku, p.productCode, p.brand, p.category, p.variant, Number(p.price), p.currency, p.stock, p.lowStockAt, p.batch, p.expiryDate, p.manufacturer, p.description, p.imageUrl, b?.value ?? "", b?.format ?? "", b?.source ?? "", p.status];
  });
  const doExport = async (kind: "csv" | "xlsx") => {
    const list = sel.length ? sel : items || [];
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "csv") downloadBlob(new Blob([toCsv(EXPORT_HEADERS, exportRows(list))], { type: "text/csv" }), `inventory-${stamp}.csv`);
    else downloadBlob(await toXlsx(EXPORT_HEADERS, exportRows(list) as any), `inventory-${stamp}.xlsx`);
    toast.success(`Exported ${list.length} products`);
  };

  const assignBarcodes = async () => {
    const targets = sel.filter((p) => p.barcodes.length === 0);
    if (!targets.length) return toast.info("All selected products already have a barcode.");
    let ok = 0;
    for (const p of targets) {
      try {
        await api(`/api/products/${p.id}`, { method: "PATCH", json: { barcodes: [{ format: "code128", value: p.sku, source: "internal", isPrimary: true }] } });
        ok++;
      } catch (e) {
        toast.error(`${p.sku}: ${(e as Error).message}`);
      }
    }
    toast.success(`Added internal Code 128 barcodes (from SKU) to ${ok} product${ok === 1 ? "" : "s"}`);
    load();
  };

  const archiveSelected = async () => {
    for (const p of sel) await api(`/api/products/${p.id}`, { method: "PATCH", json: { status: "archived" } }).catch(() => {});
    toast.success(`Archived ${sel.length} products`);
    setSelected(new Set());
    load();
  };

  return (
    <div className="space-y-4">
      {lowCount > 0 && !lowOnly && status !== "archived" && (
        <Alert tone="warn" icon={<AlertTriangle className="h-4 w-4" />} title={`${lowCount} product${lowCount === 1 ? " is" : "s are"} low on stock`}>
          <button className="font-semibold underline" onClick={() => setLowOnly(true)}>Show low-stock products</button>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, SKU, barcode or category" className="py-2 pl-9" aria-label="Search products" />
        </div>
        <Select className="w-auto py-2" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }, { value: "all", label: "All" }]} />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock</label>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /> Import</Button>
          <Button variant="outline" size="sm" onClick={() => doExport("csv")} disabled={!items?.length}><FileDown className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => doExport("xlsx")} disabled={!items?.length}><FileDown className="h-4 w-4" /> XLSX</Button>
          <LinkButton href="/products/new" size="sm"><PackagePlus className="h-4 w-4" /> New product</LinkButton>
        </div>
      </div>

      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand/10 px-4 py-2.5 text-sm">
          <strong>{sel.length} selected</strong>
          <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}><Printer className="h-4 w-4" /> Print labels</Button>
          <Button size="sm" variant="outline" onClick={assignBarcodes}><Barcode className="h-4 w-4" /> Add barcodes from SKU</Button>
          {status !== "archived" && <Button size="sm" variant="outline" onClick={archiveSelected}><Archive className="h-4 w-4" /> Archive</Button>}
          <button className="ml-auto text-xs underline" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {!items ? <Skeleton className="h-96" /> : items.length === 0 ? (
        dq || category || lowOnly || status !== "active"
          ? <p className="py-12 text-center text-sm text-slate-500">No products match these filters.</p>
          : <EmptyState icon={<Package className="h-6 w-6" />} title="No products yet" action={<div className="flex gap-2"><LinkButton href="/products/new"><PackagePlus className="h-4 w-4" /> Add product</LinkButton><Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /> Import CSV/XLSX</Button></div>}>
              Add products with SKUs, prices, stock and barcodes — then scan to look them up and print labels.
            </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="w-10 px-4 py-2.5"><input type="checkbox" aria-label="Select all" checked={sel.length === items.length} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((p) => p.id)) : new Set())} /></th>
                  <th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">SKU</th><th className="px-3 py-2.5">Barcode</th><th className="px-3 py-2.5">Category</th><th className="px-3 py-2.5 text-right">Price</th><th className="px-4 py-2.5 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((p) => (
                  <tr key={p.id} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/40", selected.has(p.id) && "bg-brand/5")}>
                    <td className="px-4 py-2.5"><input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                    <td className="px-3 py-2.5">
                      <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800">{p.name.slice(0, 2).toUpperCase()}</span>}
                        <span><span className="block font-medium hover:text-brand">{p.name}</span>{p.variant && <span className="text-xs text-slate-500">{p.variant}</span>}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-2.5">{p.barcodes[0] ? <span className="flex items-center gap-1.5"><Badge>{BARCODE_MAP[p.barcodes[0].format]?.label}</Badge><span className="font-mono text-xs">{p.barcodes[0].value.length > 20 ? p.barcodes[0].value.slice(0, 19) + "…" : p.barcodes[0].value}</span></span> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-xs">{p.category || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.priceMinor ? money(p) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-semibold tabular-nums">{p.stock}</span>
                      {p.status === "archived" ? <Badge className="ml-2">Archived</Badge> : p.lowStock && <Badge tone="amber" className="ml-2">Low</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
      <BulkPrint open={printOpen} onClose={() => setPrintOpen(false)} products={sel} />
    </div>
  );
}

function BulkPrint({ open, onClose, products }: { open: boolean; onClose: () => void; products: ProductDto[] }) {
  const [settings, setSettings] = useState<LabelSettings>(DEFAULT_LABEL);
  const withCode = products.filter((p) => p.barcodes.length);
  const labels = useMemo(() => (open ? withCode.map((p) => labelFor(p, settings)).filter(Boolean) : []), [open, withCode, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = withCode[0];
  const firstSvg = useMemo(() => { try { return first ? renderBarcodeSvg(first.barcodes[0].format, first.barcodes[0].value, toRenderOptions(DEFAULT_BARCODE_STYLE)) : ""; } catch { return ""; } }, [first]);
  return (
    <Modal open={open} onClose={onClose} title={`Print labels for ${withCode.length} product${withCode.length === 1 ? "" : "s"}`} size="lg">
      {products.length > withCode.length && <Alert tone="warn" className="mb-4">{products.length - withCode.length} selected product(s) have no barcode and are skipped. Use “Add barcodes from SKU” first.</Alert>}
      {first ? (
        <LabelDesigner barcodeSvg={firstSvg} data={{ name: first.name, variant: first.variant, price: first.priceMinor ? money(first) : "", sku: first.sku }}
          settings={settings} onSettings={setSettings} name="product-labels"
          extraLabels={labels.slice(1).flatMap((l) => Array(Math.max(1, settings.copies)).fill(l))} />
      ) : <p className="text-sm text-slate-500">None of the selected products has a barcode.</p>}
    </Modal>
  );
}

type ImportResult = { row: number; sku: string; status: string; message: string };

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ summary: Record<string, number>; results: ImportResult[] } | null>(null);
  const missing = rows.length ? ["name", "sku"].filter((k) => !(k in rows[0])) : [];

  const reset = () => { setRows([]); setFileName(""); setReport(null); };
  const pick = async (file: File) => {
    try {
      const t = await parseTableFile(file);
      const keys = t.headers.map(headerKey);
      setRows(t.rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]]))));
      setFileName(file.name);
      setReport(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const run = async () => {
    setBusy(true);
    try {
      const r = await api<{ summary: Record<string, number>; results: ImportResult[] }>("/api/products/import", { method: "POST", json: { mode, rows } });
      setReport(r);
      onDone();
      toast.success(`Import finished: ${r.summary.created} created, ${r.summary.updated} updated, ${r.summary.errors} errors`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const template = () => downloadBlob(new Blob([toCsv(EXPORT_HEADERS.slice(0, -1), [["Masala Chai 250g", "CHAI-250", "P-1001", "Sathi Tea", "Beverages", "250 g", "199.00", "INR", "24", "5", "L42", "2027-03-31", "Sathi Foods, Pune", "", "", "", "", "", ""]])], { type: "text/csv" }), "inventory-template.csv");

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Import products (CSV / XLSX)" size="lg"
      footer={report ? <Button onClick={() => { reset(); onClose(); }}>Done</Button> : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={run} loading={busy} disabled={!rows.length || missing.length > 0}>Import {rows.length || ""} rows</Button></>}>
      {!report ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Columns (header row): <code className="text-xs">{EXPORT_HEADERS.slice(0, -1).join(", ")}</code>. Only <strong>name</strong> and <strong>sku</strong> are required. <button className="font-semibold text-brand underline" onClick={template}>Download template</button></p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 text-center hover:border-brand dark:border-slate-700">
            <FileUp className="h-8 w-8 text-slate-300" />
            <span className="text-sm font-semibold">{fileName || "Choose a .csv or .xlsx file"}</span>
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
          </label>
          {rows.length > 0 && <p className="text-sm">{rows.length} rows found{missing.length > 0 && <span className="font-semibold text-rose-600"> — missing required column(s): {missing.join(", ")}</span>}</p>}
          <div>
            <span className="label">If a SKU already exists</span>
            <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "skip", label: "Skip it" }, { value: "update", label: "Update it (stock change logged as adjustment)" }]} />
          </div>
          <p className="text-xs text-slate-500">Every row is validated on the server: required fields, prices, barcode check digits, duplicate SKUs/barcodes within the file and against your existing products. Barcodes without <code>barcode_source</code> are treated as existing barcodes already printed on the product.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">{report.summary.created} created</Badge><Badge tone="blue">{report.summary.updated} updated</Badge>
            <Badge>{report.summary.skipped} skipped</Badge><Badge tone="rose">{report.summary.errors} errors</Badge>
          </div>
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs dark:bg-slate-900"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Message</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.results.filter((r) => r.status !== "created").concat(report.results.filter((r) => r.status === "created")).map((r) => (
                  <tr key={r.row}><td className="px-3 py-1.5">{r.row}</td><td className="px-3 py-1.5 font-mono text-xs">{r.sku}</td>
                    <td className="px-3 py-1.5"><Badge tone={r.status === "error" ? "rose" : r.status === "created" ? "green" : r.status === "updated" ? "blue" : "slate"}>{r.status}</Badge></td>
                    <td className="px-3 py-1.5 text-xs">{r.message}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadBlob(new Blob([toCsv(["row", "sku", "status", "message"], report.results.map((r) => [r.row, r.sku, r.status, r.message]))], { type: "text/csv" }), "import-report.csv")}><FileDown className="h-4 w-4" /> Download report</Button>
        </div>
      )}
    </Modal>
  );
}
