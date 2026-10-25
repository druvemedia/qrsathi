"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Barcode, FileSpreadsheet, FileUp, IndianRupee, Package, PackagePlus, Palette, Plus, QrCode, ScanLine, Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { getType } from "@/lib/qr-types";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { Badge, EmptyState, LinkButton, LoadingSkeleton, Skeleton } from "@/components/ui";
import { QrThumb } from "@/components/qr/preview";
import { TypeGlyph } from "@/components/brand-icon";
import { useApp } from "@/components/providers";

interface Overview {
  counts: { qrCodes: number; barcodes: number; products: number; units: number; lowStock: number };
  recentCodes: { id: string; name: string; type: string; isDynamic: boolean; isHosted: boolean; createdAt: string; payload: string; design: any }[];
  recentProducts: { id: string; name: string; sku: string; stock: number; lowStockAt: number; updatedAt: string }[];
  activity: { id: string; type: string; quantity: number; balance: number; createdAt: string; note: string; product: { id: string; name: string } }[];
}

const TX: Record<string, [string, string]> = {
  created: ["Created", "bg-violet-500"], imported: ["Imported", "bg-violet-500"], in: ["Stock in", "bg-emerald-500"], out: ["Stock out", "bg-rose-500"],
  adjust: ["Adjusted", "bg-sky-500"], updated: ["Edited", "bg-zinc-400"], archived: ["Archived", "bg-amber-500"], restored: ["Restored", "bg-emerald-500"],
};

const QUICK = ["url", "upi", "whatsapp", "wifi", "instagram", "vcard", "menu", "maps"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Heading({ children, href, linkLabel = "View all" }: { children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-serif text-lg font-medium">{children}</h2>
      {href && <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">{linkLabel} <ArrowRight className="h-3 w-3" aria-hidden /></Link>}
    </div>
  );
}

export function OverviewView() {
  const { user } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [hello, setHello] = useState("Welcome");
  useEffect(() => { setHello(greeting()); }, []);
  useEffect(() => { api<Overview>("/api/overview").then(setData).catch((e) => toast.error(e.message)); }, []);
  const first = user?.name.split(" ")[0];
  const c = data?.counts;
  const fan = data?.recentCodes.slice(0, 3) ?? [];

  const facts = c ? [
    { label: "QR codes", value: c.qrCodes, href: "/codes" },
    { label: "Products", value: c.products, href: "/products" },
    { label: "Barcodes", value: c.barcodes, href: "/products" },
    { label: "Units in stock", value: c.units, href: "/inventory" },
  ] : [];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-zinc-950 px-6 py-8 text-white sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden
          style={{ background: "radial-gradient(70% 90% at 85% 10%, hsl(var(--brand) / .55), transparent 60%), radial-gradient(50% 70% at 10% 110%, hsl(var(--accent) / .35), transparent 60%)" }} />
        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/60">{user?.planName} plan</p>
            <h1 className="mt-2 font-serif text-3xl font-medium leading-tight tracking-[-0.02em] sm:text-[2.6rem]">{hello}{first ? `, ${first}` : ""}.</h1>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/generator" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:-translate-y-px hover:shadow-md active:scale-[.98]">
                <Plus className="h-4 w-4" aria-hidden /> Create QR code
              </Link>
              <Link href="/barcodes" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium ring-1 ring-inset ring-white/20 transition hover:bg-white/15"><Barcode className="h-4 w-4" aria-hidden /> Barcode</Link>
              <Link href="/scanner" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium ring-1 ring-inset ring-white/20 transition hover:bg-white/15"><ScanLine className="h-4 w-4" aria-hidden /> Scan</Link>
            </div>
            <dl className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
              {c ? facts.map((f) => (
                <Link key={f.label} href={f.href} className="group">
                  <dt className="text-[11px] text-white/55 group-hover:text-white/80">{f.label}</dt>
                  <dd className="font-serif text-2xl tabular-nums">{formatNumber(f.value)}</dd>
                </Link>
              )) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11 w-20 bg-white/10" />)}
            </dl>
          </div>
          {fan.length > 0 && (
            <div className="relative mx-auto hidden h-44 w-56 md:block" aria-hidden>
              {fan.map((q, i) => (
                <div key={q.id} className="absolute left-1/2 top-1/2 h-32 w-32 rounded-2xl bg-white p-2.5 shadow-2xl transition-transform duration-300"
                  style={{ transform: `translate(-50%,-50%) translateX(${(i - (fan.length - 1) / 2) * 44}px) rotate(${(i - (fan.length - 1) / 2) * 9}deg)`, zIndex: i === Math.floor(fan.length / 2) ? 3 : 1 }}>
                  <QrThumb payload={q.payload} design={q.design} idKey="fan" className="h-full w-full" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {c && c.lowStock > 0 && (
        <Link href="/products?low=1" className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-500/20">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1"><b className="font-semibold">{c.lowStock}</b> {c.lowStock === 1 ? "product needs" : "products need"} restocking</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}

      {/* Quick create */}
      <section>
        <Heading>Quick create</Heading>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {QUICK.map((id) => {
            const t = getType(id);
            return (
              <Link key={id} href={`/generator?type=${id}`} title={t.description}
                className="group flex flex-col items-center gap-2 rounded-2xl px-1 py-3 text-center transition hover:-translate-y-0.5 hover:bg-white hover:shadow-card dark:hover:bg-slate-900">
                <TypeGlyph brand={t.brand} icon={t.icon} size="lg" className="transition-transform duration-200 group-hover:scale-105" />
                <span className="w-full truncate text-xs font-medium text-slate-700 dark:text-slate-300">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Recent codes */}
        <section>
          <Heading href="/codes">Recent QR codes</Heading>
          {!data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}</div>
          ) : data.recentCodes.length === 0 ? (
            <EmptyState icon={<QrCode />} title="Your first QR code is a minute away" action={<LinkButton href="/generator"><Plus className="h-4 w-4" /> Create a QR code</LinkButton>}>
              Saved and dynamic codes appear here.
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.recentCodes.map((q) => {
                const t = getType(q.type);
                return (
                  <li key={q.id}>
                    <Link href={`/generator?id=${q.id}`} className="group block rounded-2xl border border-slate-200/80 bg-white p-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-pop dark:border-slate-800 dark:bg-slate-900">
                      <div className="relative rounded-xl bg-slate-50 p-4 dark:bg-white">
                        <QrThumb payload={q.payload} design={q.design} className="mx-auto aspect-square w-full max-w-[140px]" />
                        <ArrowUpRight className="absolute right-2 top-2 h-4 w-4 text-slate-400 opacity-0 transition group-hover:opacity-100" aria-hidden />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <TypeGlyph brand={t.brand} icon={t.icon} size="sm" className="h-6 w-6 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5" />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{q.name}</p>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate">{formatDate(q.createdAt)}</span>
                        <Badge tone={q.isDynamic ? "violet" : "slate"}>{q.isHosted ? "Hosted" : q.isDynamic ? "Dynamic" : "Static"}</Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-10">
          {/* Activity timeline */}
          <section>
            <Heading href="/inventory">Inventory activity</Heading>
            {!data ? <LoadingSkeleton rows={3} /> : data.activity.length === 0 ? (
              <EmptyState compact icon={<Warehouse />} title="No stock movements yet" action={<LinkButton href="/products/new" size="sm" variant="outline">Add a product</LinkButton>} />
            ) : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-800">
                {data.activity.slice(0, 6).map((t) => (
                  <li key={t.id} className="relative">
                    <span className={cn("absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ring-4 ring-slate-50 dark:ring-slate-950", TX[t.type]?.[1] || "bg-zinc-400")} aria-hidden />
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/products/${t.product.id}`} className="truncate text-sm font-medium hover:text-brand">{t.product.name}</Link>
                      <span className={cn("shrink-0 text-sm font-medium tabular-nums", t.quantity > 0 ? "text-emerald-600" : t.quantity < 0 ? "text-rose-600" : "text-slate-400")}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity || "—"}</span>
                    </div>
                    <p className="text-xs text-slate-500">{TX[t.type]?.[0] || t.type} · {formatDate(t.createdAt, true)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Products */}
          {data && data.recentProducts.length > 0 && (
            <section>
              <Heading href="/products">Products</Heading>
              <ul className="space-y-1">
                {data.recentProducts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/products/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white dark:hover:bg-slate-900">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-500 dark:bg-slate-800">{p.name.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name}</p><p className="truncate font-mono text-[11px] text-slate-500">{p.sku}</p></div>
                      <span className={cn("text-sm font-medium tabular-nums", p.stock <= p.lowStockAt && "text-amber-600")}>{p.stock}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Tools */}
          <section>
            <Heading>Tools</Heading>
            <div className="flex flex-wrap gap-2">
              {[
                { href: "/products/new", icon: PackagePlus, label: "Add product" },
                { href: "/products?import=1", icon: FileUp, label: "Import CSV/XLSX" },
                { href: "/upi", icon: IndianRupee, label: "UPI standee" },
                { href: "/bulk", icon: FileSpreadsheet, label: "Bulk generate" },
                { href: "/studio", icon: Palette, label: "Design studio" },
                { href: "/products", icon: Package, label: "Catalogue" },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:shadow-card dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <a.icon className="h-3.5 w-3.5 text-slate-400" aria-hidden /> {a.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
