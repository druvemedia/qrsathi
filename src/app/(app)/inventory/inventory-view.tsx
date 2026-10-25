"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, CalendarClock, Camera, Package, PackagePlus, ScanBarcode, Search, SlidersHorizontal, Warehouse } from "lucide-react";
import { toast } from "sonner";
import type { ProductDto } from "@/lib/products";
import { api } from "@/lib/fetcher";
import { formatDate, formatNumber } from "@/lib/utils";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, FilterBar, Input, LinkButton, SearchInput, Section, Select, Skeleton, StatCard } from "@/components/ui";

interface Summary {
  totals: { products: number; archived: number; units: number; lowStock: number; outOfStock: number; in30: number; out30: number };
  valueByCurrency: Record<string, number>;
  lowStock: { id: string; name: string; sku: string; stock: number; lowStockAt: number }[];
  expiringSoon: { id: string; name: string; sku: string; expiryDate: string; stock: number }[];
  recent: { id: string; type: string; quantity: number; balance: number; note: string; reference: string; createdAt: string; product: { id: string; name: string; sku: string } }[];
}

const TX: Record<string, [string, "green" | "rose" | "blue" | "slate" | "amber" | "violet"]> = {
  created: ["Created", "violet"], imported: ["Imported", "violet"], in: ["Stock in", "green"], out: ["Stock out", "rose"],
  adjust: ["Adjusted", "blue"], updated: ["Edited", "slate"], archived: ["Archived", "amber"], restored: ["Restored", "green"],
};

export function InventoryView() {
  const [s, setS] = useState<Summary | null>(null);
  const load = useCallback(() => { api<Summary>("/api/inventory").then(setS).catch((e) => toast.error(e.message)); }, []);
  useEffect(load, [load]);
  const [aq, setAq] = useState("");
  const [atype, setAtype] = useState("");

  if (!s) return <div className="space-y-4"><Skeleton className="h-36 rounded-xl" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</div></div>;
  if (s.totals.products === 0 && s.totals.archived === 0)
    return <EmptyState icon={<Warehouse className="h-5 w-5" />} title="No inventory yet" action={<div className="flex flex-wrap justify-center gap-2"><LinkButton href="/products/new"><PackagePlus className="h-4 w-4" /> Add your first product</LinkButton><LinkButton href="/products?import=1" variant="outline">Import CSV/XLSX</LinkButton></div>}>Add products (or import a spreadsheet) to track stock, get low-stock alerts and record stock in/out.</EmptyState>;

  const values = Object.entries(s.valueByCurrency).filter(([, v]) => v > 0);
  const activity = s.recent.filter((t) => (!atype || t.type === atype) && (!aq || `${t.product.name} ${t.product.sku} ${t.note} ${t.reference}`.toLowerCase().includes(aq.toLowerCase())));
  return (
    <div className="space-y-6">
      <QuickMove onMoved={load} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active products" value={formatNumber(s.totals.products)} hint={`${s.totals.archived} archived`} icon={<Package />} href="/products" />
        <StatCard label="Units in stock" value={formatNumber(s.totals.units)} hint={`+${formatNumber(s.totals.in30)} in · −${formatNumber(s.totals.out30)} out (30 days)`} icon={<Boxes />} />
        <StatCard label="Low / out of stock" value={s.totals.lowStock} tone={s.totals.lowStock ? "warn" : undefined} hint={`${s.totals.outOfStock} out of stock`} icon={<AlertTriangle />} href="/products?low=1" />
        <StatCard label="Stock value (at price)" value={values.length ? new Intl.NumberFormat("en-IN", { style: "currency", currency: values[0][0], maximumFractionDigits: 0 }).format(values[0][1] / 100) : "—"}
          hint={values.length > 1 ? values.slice(1).map(([c, v]) => new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v / 100)).join(" · ") : "Price × stock of active products"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden /> Low-stock alerts</span>} bodyClassName="p-0"
          actions={<Link href="/products?low=1" className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">View all</Link>}>
          {s.lowStock.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">All products are above their alert level.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.lowStock.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/products/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand">{p.name}</Link>
                  <span className="hidden font-mono text-xs text-slate-500 sm:inline">{p.sku}</span>
                  <Badge tone={p.stock <= 0 ? "rose" : "amber"}>{p.stock <= 0 ? "Out of stock" : `${p.stock} left`}</Badge>
                  <Link href={`/products/${p.id}?stock=in`} className="text-xs font-medium text-brand">Restock</Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={<span className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-rose-500" aria-hidden /> Expiring within 30 days</span>} bodyClassName="p-0">
          {s.expiringSoon.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">Nothing expiring soon.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.expiringSoon.map((p) => {
                const expired = new Date(p.expiryDate) < new Date();
                return (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <Link href={`/products/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand">{p.name}</Link>
                    <span className="text-xs text-slate-500">{p.stock} units</span>
                    <Badge tone={expired ? "rose" : "amber"}>{expired ? "Expired " : ""}{formatDate(p.expiryDate)}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Recent inventory activity" description="The latest 40 movements and changes" bodyClassName="p-0">
        <FilterBar className="px-5 py-3">
          <SearchInput value={aq} onChange={setAq} placeholder="Filter by product, SKU, note" className="w-full sm:w-64" />
          <Select className="w-full sm:w-44" value={atype} onChange={(e) => setAtype(e.target.value)} aria-label="Action type">
            <option value="">All actions</option>
            {Object.entries(TX).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </FilterBar>
        {activity.length === 0 ? <p className="border-t border-slate-100 px-5 py-6 text-center text-sm text-slate-500 dark:border-slate-800">No activity matches.</p> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Product</th><th>Action</th><th className="text-right">Change</th><th className="text-right">Balance</th><th className="hidden md:table-cell">Note</th></tr></thead>
              <tbody>
                {activity.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{formatDate(t.createdAt, true)}</td>
                    <td><Link href={`/products/${t.product.id}`} className="font-medium hover:text-brand">{t.product.name}</Link> <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">{t.product.sku}</span></td>
                    <td><Badge tone={TX[t.type]?.[1] || "slate"}>{TX[t.type]?.[0] || t.type}</Badge></td>
                    <td className={`text-right font-medium tabular-nums ${t.quantity > 0 ? "text-emerald-600" : t.quantity < 0 ? "text-rose-600" : "text-slate-400"}`}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity || "—"}</td>
                    <td className="text-right tabular-nums">{t.balance}</td>
                    <td className="hidden text-xs text-slate-500 md:table-cell">{[t.note, t.reference && `Ref ${t.reference}`].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

/** Look up a product by barcode/SKU (USB scanners type + Enter), then record an explicit movement. */
function QuickMove({ onMoved }: { onMoved: () => void }) {
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [notFound, setNotFound] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAdjust, setConfirmAdjust] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const c = code.trim();
    if (!c || busy) return;
    setBusy("lookup");
    setNotFound("");
    try {
      const r = await api<{ found: boolean; item?: ProductDto }>(`/api/products/lookup?code=${encodeURIComponent(c)}`);
      setProduct(r.found ? r.item! : null);
      if (!r.found) setNotFound(c);
      setQty("1");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const move = async (type: "in" | "out" | "adjust") => {
    if (!product || busy) return;
    const n = Number(qty);
    if (!Number.isInteger(n) || n < (type === "adjust" ? 0 : 1)) return toast.error(type === "adjust" ? "Enter the counted quantity (0 or more)." : "Enter a whole quantity of at least 1.");
    setBusy(type);
    try {
      const { item } = await api<{ item: ProductDto }>(`/api/products/${product.id}/stock`, { method: "POST", json: { type, quantity: n, note: type === "adjust" ? "Stock count (quick)" : "Quick movement" } });
      toast.success(type === "adjust" ? `${item.name}: stock set to ${item.stock}` : `${type === "in" ? "+" : "−"}${n} ${item.name} · now ${item.stock}`);
      setProduct(item);
      setCode("");
      setConfirmAdjust(false);
      input.current?.focus();
      onMoved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="lg:w-[400px]">
          <h2 className="flex items-center gap-2 section-title"><ScanBarcode className="h-4 w-4 text-brand" aria-hidden /> Scan or enter a barcode</h2>
          <p className="mt-1 text-xs text-slate-500">USB and Bluetooth barcode scanners type straight into this box. Scanning only finds the product — stock changes only when you press a button.</p>
          <form onSubmit={lookup} className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input ref={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Barcode or SKU, then Enter" className="h-11 pl-9 font-mono text-base" aria-label="Barcode or SKU" autoComplete="off" />
            </div>
            <Button type="submit" size="lg" loading={busy === "lookup"}>Find</Button>
          </form>
          <Link href="/scanner?camera=1" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand"><Camera className="h-3.5 w-3.5" aria-hidden /> Use the camera instead</Link>
        </div>
        <div className="min-w-0 flex-1">
          {product ? (
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/products/${product.id}`} className="font-medium hover:text-brand">{product.name}</Link>
                  <p className="text-xs text-slate-500">SKU {product.sku}{product.variant && ` · ${product.variant}`}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">In stock</p>
                  <p className="text-2xl font-semibold tabular-nums">{product.stock}</p>
                </div>
              </div>
              <div className="mt-1 flex gap-1.5">{product.lowStock && <Badge tone="amber">Low stock</Badge>}{product.status === "archived" && <Badge>Archived — restore to change stock</Badge>}</div>
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <Field label="Quantity" htmlFor="qm-qty" className="w-24"><Input id="qm-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
                <Button onClick={() => move("in")} loading={busy === "in"} disabled={product.status !== "active"}><ArrowDownToLine className="h-4 w-4" /> Stock in</Button>
                <Button variant="outline" onClick={() => move("out")} loading={busy === "out"} disabled={product.status !== "active"}><ArrowUpFromLine className="h-4 w-4" /> Stock out</Button>
                <Button variant="outline" onClick={() => setConfirmAdjust(true)} disabled={product.status !== "active"}><SlidersHorizontal className="h-4 w-4" /> Adjust</Button>
              </div>
            </div>
          ) : notFound ? (
            <Alert tone="info" title="No product with this barcode or SKU">
              <span className="font-mono">{notFound}</span> — <Link href={`/products/new?barcode=${encodeURIComponent(notFound)}`} className="font-medium underline">register it as a new product</Link>
            </Alert>
          ) : (
            <p className="grid h-full min-h-[120px] place-items-center rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Scan or enter a code to see the product here.</p>
          )}
        </div>
      </div>
      {product && (
        <ConfirmDialog open={confirmAdjust} onClose={() => setConfirmAdjust(false)} onConfirm={async () => { await move("adjust"); }} tone="primary"
          title={`Set stock of “${product.name}” to ${qty}?`} confirmLabel={`Set stock to ${qty}`}>
          This replaces the recorded stock of <strong>{product.stock}</strong> with your counted quantity <strong>{qty}</strong>. Use it after a physical stock-take; the change is logged in the activity history.
        </ConfirmDialog>
      )}
    </Card>
  );
}
