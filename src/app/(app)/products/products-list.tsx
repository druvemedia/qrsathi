"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Barcode, FileDown, FileUp, Package, PackagePlus, Printer } from "lucide-react";
import { toast } from "sonner";
import type { ProductDto } from "@/lib/products";
import { BARCODE_MAP, renderBarcodeSvg, renderLabelSvg } from "@/lib/barcodes";
import { api } from "@/lib/fetcher";
import { downloadBlob } from "@/lib/qr-export";
import { headerKey, parseTableFile, toCsv, toXlsx } from "@/lib/table-file";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, FilterBar, LinkButton, LoadingSkeleton, Modal, SearchInput, Segmented, Select, Stepper } from "@/components/ui";
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
  const [confirmArchive, setConfirmArchive] = useState(false);
  useEffect(() => { if (sp.get("import") === "1") setImportOpen(true); }, [sp]);

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

  const setArchived = async (list: ProductDto[], status: "archived" | "active") => {
    const done: ProductDto[] = [];
    for (const p of list) {
      try { await api(`/api/products/${p.id}`, { method: "PATCH", json: { status } }); done.push(p); } catch (e) { toast.error(`${p.sku}: ${(e as Error).message}`); }
    }
    return done;
  };
  const archiveSelected = async () => {
    const done = await setArchived(sel, "archived");
    setSelected(new Set());
    setConfirmArchive(false);
    load();
    if (done.length)
      toast.success(`Archived ${done.length} product${done.length === 1 ? "" : "s"}`, {
        action: { label: "Undo", onClick: async () => { await setArchived(done, "active"); toast.success("Restored"); load(); } },
      });
  };

  const filtersActive = !!(dq || category || lowOnly || status !== "active");
  const statusBadge = (p: ProductDto) =>
    p.status === "archived" ? <Badge>Archived</Badge> : p.stock <= 0 ? <Badge tone="rose">Out of stock</Badge> : p.lowStock ? <Badge tone="amber">Low stock</Badge> : <Badge tone="green">In stock</Badge>;

  return (
    <div className="space-y-4">
      {lowCount > 0 && !lowOnly && status !== "archived" && (
        <Alert tone="warn" icon={<AlertTriangle className="h-4 w-4" />} title={`${lowCount} product${lowCount === 1 ? " is" : "s are"} low on stock`}>
          <button className="font-medium underline" onClick={() => setLowOnly(true)}>Show only low-stock products</button>
        </Alert>
      )}

      <FilterBar
        actions={<>
          <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /> Import</Button>
          <ExportMenu disabled={!items?.length} onExport={doExport} count={sel.length || items?.length || 0} />
          <LinkButton href="/products/new"><PackagePlus className="h-4 w-4" /> Add product</LinkButton>
        </>}>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU, barcode, category" className="w-full sm:w-72" />
        <Select className="w-full sm:w-44" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }, { value: "all", label: "All" }]} />
        <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="accent-[hsl(var(--brand))]" /> Low stock only
        </label>
        {filtersActive && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setCategory(""); setStatus("active"); setLowOnly(false); }}>Reset</Button>}
      </FilterBar>

      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-sm" role="region" aria-label="Bulk actions">
          <span className="font-medium">{sel.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}><Printer className="h-3.5 w-3.5" /> Print labels</Button>
          <Button size="sm" variant="outline" onClick={assignBarcodes}><Barcode className="h-3.5 w-3.5" /> Add barcodes from SKU</Button>
          {status !== "archived" && <Button size="sm" variant="outline" onClick={() => setConfirmArchive(true)}><Archive className="h-3.5 w-3.5" /> Archive</Button>}
          <button className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {!items ? <Card className="p-4"><LoadingSkeleton rows={6} /></Card> : items.length === 0 ? (
        filtersActive
          ? <EmptyState icon={<Package className="h-5 w-5" />} title="No products match these filters" action={<Button variant="outline" onClick={() => { setQ(""); setCategory(""); setStatus("active"); setLowOnly(false); }}>Reset filters</Button>} />
          : <EmptyState icon={<Package className="h-5 w-5" />} title="No products yet" action={<div className="flex flex-wrap justify-center gap-2"><LinkButton href="/products/new"><PackagePlus className="h-4 w-4" /> Add product</LinkButton><Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /> Import CSV/XLSX</Button></div>}>
              Add products with SKUs, prices, stock and barcodes — then scan to look them up and print labels.
            </EmptyState>
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10"><input type="checkbox" aria-label="Select all products" checked={sel.length === items.length} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((p) => p.id)) : new Set())} className="accent-[hsl(var(--brand))]" /></th>
                    <th>Product</th><th>SKU</th><th className="hidden lg:table-cell">Barcode</th><th className="text-right">Price</th><th className="text-right">Stock</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className={cn(selected.has(p.id) && "bg-brand/5")}>
                      <td><input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="accent-[hsl(var(--brand))]" /></td>
                      <td>
                        <Link href={`/products/${p.id}`} className="flex min-w-[180px] items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-slate-800">{p.name.slice(0, 2).toUpperCase()}</span>}
                          <span className="min-w-0"><span className="block truncate font-medium hover:text-brand">{p.name}</span><span className="block truncate text-xs text-slate-500">{[p.category, p.variant].filter(Boolean).join(" · ") || "—"}</span></span>
                        </Link>
                      </td>
                      <td className="font-mono text-xs">{p.sku}</td>
                      <td className="hidden lg:table-cell">{p.barcodes[0] ? <span className="flex items-center gap-1.5"><Badge>{BARCODE_MAP[p.barcodes[0].format]?.label}</Badge><span className="font-mono text-xs">{p.barcodes[0].value.length > 20 ? p.barcodes[0].value.slice(0, 19) + "…" : p.barcodes[0].value}</span></span> : <span className="text-xs text-slate-400">—</span>}</td>
                      <td className="text-right tabular-nums">{p.priceMinor ? money(p) : "—"}</td>
                      <td className={cn("text-right font-medium tabular-nums", p.lowStock && p.status === "active" && "text-amber-600 dark:text-amber-400")}>{p.stock}</td>
                      <td>{statusBadge(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">{items.length} product{items.length === 1 ? "" : "s"}</p>
          </Card>

          {/* Mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {items.map((p) => (
              <li key={p.id} className={cn("card flex items-start gap-3 p-3", selected.has(p.id) && "ring-1 ring-brand")}>
                <input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="mt-1 h-4 w-4 accent-[hsl(var(--brand))]" />
                <Link href={`/products/${p.id}`} className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium">{p.name}</p>
                    <span className={cn("shrink-0 text-sm font-semibold tabular-nums", p.lowStock && p.status === "active" && "text-amber-600")}>{p.stock}</span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{p.sku}{p.barcodes[0] && ` · ${p.barcodes[0].value}`}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">{p.priceMinor ? money(p) : "No price"}</span>
                    {statusBadge(p)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
      <BulkPrint open={printOpen} onClose={() => setPrintOpen(false)} products={sel} />
      <ConfirmDialog open={confirmArchive} onClose={() => setConfirmArchive(false)} onConfirm={archiveSelected} title={`Archive ${sel.length} product${sel.length === 1 ? "" : "s"}?`} confirmLabel="Archive" tone="primary">
        Archived products are hidden from lists and their stock can&apos;t change. Barcodes and history are kept, and you can restore them any time.
      </ConfirmDialog>
    </div>
  );
}

function ExportMenu({ disabled, onExport, count }: { disabled: boolean; onExport: (k: "csv" | "xlsx") => void; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((o) => !o)} disabled={disabled} aria-haspopup="menu" aria-expanded={open} onBlur={() => setTimeout(() => setOpen(false), 150)}>
        <FileDown className="h-4 w-4" /> Export
      </Button>
      {open && (
        <div role="menu" className="card absolute right-0 top-11 z-20 w-56 p-1 shadow-pop">
          <p className="px-2.5 py-1.5 text-[11px] text-slate-500">{count} product{count === 1 ? "" : "s"}</p>
          {(["csv", "xlsx"] as const).map((k) => (
            <button key={k} role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); onExport(k); }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              <FileDown className="h-4 w-4 text-slate-400" /> {k === "csv" ? "CSV (.csv)" : "Excel (.xlsx)"}
            </button>
          ))}
        </div>
      )}
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
      <Stepper className="mb-4" steps={["Upload file", "Check & preview", "Import", "Review results"]} current={report ? 3 : busy ? 2 : rows.length ? 1 : 0} />
      {!report ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Columns (header row): <code className="text-xs">{EXPORT_HEADERS.slice(0, -1).join(", ")}</code>. Only <strong>name</strong> and <strong>sku</strong> are required. <button className="font-semibold text-brand underline" onClick={template}>Download template</button></p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 text-center hover:border-brand dark:border-slate-700">
            <FileUp className="h-8 w-8 text-slate-300" />
            <span className="text-sm font-semibold">{fileName || "Choose a .csv or .xlsx file"}</span>
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
          </label>
          {rows.length > 0 && <p className="text-sm">{rows.length} rows found{missing.length > 0 && <span className="font-semibold text-rose-600"> — missing required column(s): {missing.join(", ")}</span>}</p>}
          {rows.length > 0 && missing.length === 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="table">
                <thead><tr><th>#</th><th>Name</th><th>SKU</th><th>Price</th><th>Stock</th><th>Barcode</th></tr></thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}><td className="text-slate-400">{i + 2}</td><td>{r.name || <span className="text-rose-600">missing</span>}</td><td className="font-mono text-xs">{r.sku || <span className="text-rose-600">missing</span>}</td><td>{r.price}</td><td>{r.stock}</td><td className="font-mono text-xs">{r.barcode}</td></tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">Preview of the first 5 of {rows.length} rows. Every row is validated on import.</p>}
            </div>
          )}
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
