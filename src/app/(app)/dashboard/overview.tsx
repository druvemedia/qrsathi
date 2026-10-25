"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, Barcode, Boxes, FileSpreadsheet, FileUp, IndianRupee, Package, PackagePlus, Palette, QrCode, ScanLine, Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { getType } from "@/lib/qr-types";
import { formatDate, formatNumber } from "@/lib/utils";
import { Badge, Card, EmptyState, LinkButton, LoadingSkeleton, Skeleton, StatCard } from "@/components/ui";
import { QrThumb } from "@/components/qr/preview";
import { useApp } from "@/components/providers";

interface Overview {
  counts: { qrCodes: number; barcodes: number; products: number; units: number; lowStock: number };
  recentCodes: { id: string; name: string; type: string; isDynamic: boolean; isHosted: boolean; createdAt: string; payload: string; design: any }[];
  recentProducts: { id: string; name: string; sku: string; stock: number; lowStockAt: number; updatedAt: string }[];
  activity: { id: string; type: string; quantity: number; balance: number; createdAt: string; note: string; product: { id: string; name: string } }[];
}

const TX: Record<string, [string, "green" | "rose" | "blue" | "slate" | "amber" | "violet"]> = {
  created: ["Created", "violet"], imported: ["Imported", "violet"], in: ["Stock in", "green"], out: ["Stock out", "rose"],
  adjust: ["Adjusted", "blue"], updated: ["Edited", "slate"], archived: ["Archived", "amber"], restored: ["Restored", "green"],
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Panel({ title, href, linkLabel = "View all", children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <h2 className="section-title">{title}</h2>
        {href && <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">{linkLabel} <ArrowRight className="h-3 w-3" /></Link>}
      </div>
      <div className="p-2">{children}</div>
    </Card>
  );
}

export function OverviewView() {
  const { user, settings } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [hello, setHello] = useState("Welcome");
  useEffect(() => { setHello(greeting()); }, []);
  useEffect(() => { api<Overview>("/api/overview").then(setData).catch((e) => toast.error(e.message)); }, []);
  const first = user?.name.split(" ")[0];
  const c = data?.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{settings.siteName} workspace · {user?.planName} plan</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{hello}{first ? `, ${first}` : ""}</h1>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <LinkButton href="/generator" size="lg" className="px-3 sm:px-5"><QrCode className="h-4 w-4" /> <span>Create QR</span></LinkButton>
          <LinkButton href="/barcodes" size="lg" variant="outline" className="px-3 sm:px-5"><Barcode className="h-4 w-4" /> <span>Barcode</span></LinkButton>
          <LinkButton href="/scanner" size="lg" variant="outline" className="px-3 sm:px-5"><ScanLine className="h-4 w-4" /> <span>Scan</span></LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {c ? (
          <>
            <StatCard label="QR codes" value={formatNumber(c.qrCodes)} icon={<QrCode />} href="/codes" />
            <StatCard label="Barcodes" value={formatNumber(c.barcodes)} hint="On active products" icon={<Barcode />} href="/products" />
            <StatCard label="Products" value={formatNumber(c.products)} icon={<Package />} href="/products" />
            <StatCard label="Units in stock" value={formatNumber(c.units)} icon={<Boxes />} href="/inventory" />
            <StatCard label="Low-stock alerts" value={c.lowStock} icon={<AlertTriangle />} href="/products?low=1" tone={c.lowStock ? "warn" : undefined} hint={c.lowStock ? "Need restocking" : "All good"} />
          </>
        ) : Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Recently created codes" href="/codes">
            {!data ? <LoadingSkeleton rows={3} className="p-3" /> : data.recentCodes.length === 0 ? (
              <EmptyState compact icon={<QrCode className="h-5 w-5" />} title="No saved codes yet" action={<LinkButton href="/generator" size="sm">Create your first QR code</LinkButton>}>
                Codes you save or make dynamic appear here.
              </EmptyState>
            ) : (
              <ul>
                {data.recentCodes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/generator?id=${q.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <QrThumb payload={q.payload} design={q.design} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{q.name}</p>
                        <p className="text-xs text-slate-500">{getType(q.type).label} · {formatDate(q.createdAt)}</p>
                      </div>
                      <Badge tone={q.isDynamic ? "violet" : "slate"}>{q.isHosted ? "Hosted" : q.isDynamic ? "Dynamic" : "Static"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent inventory activity" href="/inventory">
            {!data ? <LoadingSkeleton rows={3} className="p-3" /> : data.activity.length === 0 ? (
              <EmptyState compact icon={<Warehouse className="h-5 w-5" />} title="No inventory activity yet" action={<LinkButton href="/products/new" size="sm">Add a product</LinkButton>}>
                Stock movements and product changes are recorded here.
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Product</th><th>Action</th><th className="text-right">Change</th><th className="hidden sm:table-cell">When</th></tr></thead>
                  <tbody>
                    {data.activity.map((t) => (
                      <tr key={t.id}>
                        <td><Link href={`/products/${t.product.id}`} className="font-medium hover:text-brand">{t.product.name}</Link></td>
                        <td><Badge tone={TX[t.type]?.[1] || "slate"}>{TX[t.type]?.[0] || t.type}</Badge></td>
                        <td className={`text-right font-medium tabular-nums ${t.quantity > 0 ? "text-emerald-600" : t.quantity < 0 ? "text-rose-600" : "text-slate-400"}`}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity || "—"}</td>
                        <td className="hidden whitespace-nowrap text-xs text-slate-500 sm:table-cell">{formatDate(t.createdAt, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Recently updated products" href="/products">
            {!data ? <LoadingSkeleton rows={3} className="p-3" /> : data.recentProducts.length === 0 ? (
              <EmptyState compact icon={<Package className="h-5 w-5" />} title="No products yet" action={<LinkButton href="/products/new" size="sm">Add product</LinkButton>}>
                Track SKUs, barcodes, prices and stock.
              </EmptyState>
            ) : (
              <ul>
                {data.recentProducts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/products/${p.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-slate-800">{p.name.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name}</p><p className="truncate font-mono text-[11px] text-slate-500">{p.sku}</p></div>
                      <span className={`text-sm font-medium tabular-nums ${p.stock <= p.lowStockAt ? "text-amber-600" : ""}`}>{p.stock}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Quick actions">
            <ul className="text-sm">
              {[
                { href: "/products/new", icon: PackagePlus, label: "Add a product" },
                { href: "/products?import=1", icon: FileUp, label: "Import products (CSV/XLSX)" },
                { href: "/upi", icon: IndianRupee, label: "UPI payment QR & standee" },
                { href: "/bulk", icon: FileSpreadsheet, label: "Bulk generate codes" },
                { href: "/studio", icon: Palette, label: "Design studio" },
              ].map((a) => (
                <li key={a.href}>
                  <Link href={a.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50">
                    <a.icon className="h-4 w-4 text-slate-400" aria-hidden /> {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
