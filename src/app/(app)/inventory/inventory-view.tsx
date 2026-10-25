"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, CalendarClock, Camera, Package, PackagePlus, ScanBarcode, Search, Warehouse } from "lucide-react";
import { toast } from "sonner";
import type { ProductDto } from "@/lib/products";
import { api } from "@/lib/fetcher";
import { formatDate, formatNumber } from "@/lib/utils";
import { Alert, Badge, Button, Card, EmptyState, Input, LinkButton, Skeleton, StatCard } from "@/components/ui";

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

  if (!s) return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (s.totals.products === 0 && s.totals.archived === 0)
    return <EmptyState icon={<Warehouse className="h-6 w-6" />} title="No inventory yet" action={<LinkButton href="/products/new"><PackagePlus className="h-4 w-4" /> Add your first product</LinkButton>}>Add products (or import a spreadsheet) to track stock, get low-stock alerts and record stock in/out.</EmptyState>;

  const values = Object.entries(s.valueByCurrency).filter(([, v]) => v > 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active products" value={formatNumber(s.totals.products)} hint={`${s.totals.archived} archived`} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Units in stock" value={formatNumber(s.totals.units)} hint={`+${formatNumber(s.totals.in30)} in · −${formatNumber(s.totals.out30)} out (30 days)`} icon={<Boxes className="h-4 w-4" />} />
        <StatCard label="Low / out of stock" value={<span className={s.totals.lowStock ? "text-amber-600" : undefined}>{s.totals.lowStock}</span>} hint={`${s.totals.outOfStock} out of stock`} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Stock value (at price)" value={values.length ? new Intl.NumberFormat("en-IN", { style: "currency", currency: values[0][0], maximumFractionDigits: 0 }).format(values[0][1] / 100) : "—"}
          hint={values.length > 1 ? values.slice(1).map(([c, v]) => new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v / 100)).join(" · ") : "Price × stock of active products"} />
      </div>

      <QuickMove onMoved={load} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="flex items-center gap-2 font-display text-base font-bold"><AlertTriangle className="h-4 w-4 text-amber-500" /> Low-stock alerts</h2>
            <Link href="/products?low=1" className="text-xs font-semibold text-brand">View all →</Link>
          </div>
          {s.lowStock.length === 0 ? <p className="px-5 pb-5 text-sm text-slate-500">All products are above their alert level.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.lowStock.slice(0, 10).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/products/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand">{p.name}</Link>
                  <span className="font-mono text-xs text-slate-500">{p.sku}</span>
                  <Badge tone={p.stock <= 0 ? "rose" : "amber"}>{p.stock} left</Badge>
                  <Link href={`/products/${p.id}?stock=in`} className="text-xs font-semibold text-brand">Restock</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="p-5 pb-3"><h2 className="flex items-center gap-2 font-display text-base font-bold"><CalendarClock className="h-4 w-4 text-rose-500" /> Expiring within 30 days</h2></div>
          {s.expiringSoon.length === 0 ? <p className="px-5 pb-5 text-sm text-slate-500">Nothing expiring soon.</p> : (
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
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 pb-3"><h2 className="font-display text-base font-bold">Recent inventory activity</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50"><tr><th className="px-5 py-2">When</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Action</th><th className="px-3 py-2 text-right">Change</th><th className="px-3 py-2 text-right">Balance</th><th className="px-5 py-2">Note</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.recent.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-5 py-2 text-xs text-slate-500">{formatDate(t.createdAt, true)}</td>
                  <td className="px-3 py-2"><Link href={`/products/${t.product.id}`} className="font-medium hover:text-brand">{t.product.name}</Link> <span className="font-mono text-[11px] text-slate-400">{t.product.sku}</span></td>
                  <td className="px-3 py-2"><Badge tone={TX[t.type]?.[1] || "slate"}>{TX[t.type]?.[0] || t.type}</Badge></td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${t.quantity > 0 ? "text-emerald-600" : t.quantity < 0 ? "text-rose-600" : "text-slate-400"}`}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.balance}</td>
                  <td className="px-5 py-2 text-xs text-slate-500">{[t.note, t.reference && `Ref ${t.reference}`].filter(Boolean).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
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
  const input = useRef<HTMLInputElement>(null);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const c = code.trim();
    if (!c) return;
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

  const move = async (type: "in" | "out") => {
    if (!product) return;
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1) return toast.error("Enter a whole quantity of at least 1.");
    setBusy(type);
    try {
      const { item } = await api<{ item: ProductDto }>(`/api/products/${product.id}/stock`, { method: "POST", json: { type, quantity: n, note: "Quick movement" } });
      toast.success(`${type === "in" ? "+" : "−"}${n} ${item.name} · now ${item.stock}`);
      setProduct(item);
      setCode("");
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:w-[380px]">
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><ScanBarcode className="h-4 w-4 text-brand" /> Quick stock movement</h2>
          <p className="mt-1 text-xs text-slate-500">Scan with a USB/Bluetooth barcode scanner or type a barcode or SKU, then press Enter. Nothing changes until you press Stock in / out.</p>
          <form onSubmit={lookup} className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input ref={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Barcode or SKU" className="pl-9 font-mono" aria-label="Barcode or SKU" autoComplete="off" />
            </div>
            <Button type="submit" loading={busy === "lookup"}>Find</Button>
          </form>
          <Link href="/scanner?camera=1" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand"><Camera className="h-3.5 w-3.5" /> Use phone/laptop camera instead</Link>
        </div>
        <div className="min-w-0 flex-1">
          {product ? (
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="min-w-0 flex-1">
                <Link href={`/products/${product.id}`} className="font-semibold hover:text-brand">{product.name}</Link>
                <p className="text-xs text-slate-500">SKU {product.sku}{product.variant && ` · ${product.variant}`}</p>
                <p className="mt-1 text-sm">In stock: <strong className="tabular-nums">{product.stock}</strong> {product.lowStock && <Badge tone="amber">Low</Badge>} {product.status === "archived" && <Badge>Archived</Badge>}</p>
              </div>
              <Input className="w-24" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
              <Button onClick={() => move("in")} loading={busy === "in"} disabled={product.status !== "active"}><ArrowDownToLine className="h-4 w-4" /> Stock in</Button>
              <Button variant="outline" onClick={() => move("out")} loading={busy === "out"} disabled={product.status !== "active"}><ArrowUpFromLine className="h-4 w-4" /> Stock out</Button>
            </div>
          ) : notFound ? (
            <Alert tone="info" title="No product with this barcode or SKU">
              <span className="font-mono">{notFound}</span> — <Link href={`/products/new?barcode=${encodeURIComponent(notFound)}`} className="font-semibold underline">register it as a new product</Link>
            </Alert>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Scan or enter a code to see the product here.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
