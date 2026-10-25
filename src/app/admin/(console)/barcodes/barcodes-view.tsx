"use client";
import Link from "next/link";
import { Barcode, Package } from "lucide-react";
import { Alert, LoadingSkeleton, Section, StatCard } from "@/components/ui";
import { RankBars } from "@/components/charts";
import { fmtNum, useAdminData } from "@/components/admin/data";

export function BarcodesView() {
  const { data: s, error, loading, reload } = useAdminData("/api/admin/catalog");
  if (error) return <Alert tone="error" title="Couldn't load barcode statistics">{error} <button onClick={reload} className="font-medium underline">Retry</button></Alert>;
  if (loading || !s) return <LoadingSkeleton rows={5} />;
  const internal = s.bySource.find((x: { name: string }) => x.name === "internal")?.value ?? 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stored barcodes" value={fmtNum(s.barcodes)} icon={<Barcode />} />
        <StatCard label="Generated internally" value={fmtNum(internal)} hint="Restricted-circulation numbers" />
        <StatCard label="Formats in use" value={fmtNum(s.byFormat.length)} />
        <StatCard label="Products" value={fmtNum(s.products)} icon={<Package />} href="/admin/products" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Barcodes by format"><RankBars data={s.byFormat} name="Barcodes" /></Section>
        <Section title="Barcode source" description="Generated internally, GS1-assigned, or existing manufacturer codes"><RankBars data={s.bySource} name="Barcodes" /></Section>
      </div>
      <p className="text-xs text-slate-500">Barcodes generated without saving them to a product happen entirely in the browser and aren&apos;t recorded. Inventory movements are on <Link href="/admin/products" className="underline">Products &amp; inventory</Link>.</p>
    </div>
  );
}
