"use client";
import { Archive, Barcode, Package, Users } from "lucide-react";
import { Alert, LoadingSkeleton, Section, StatCard } from "@/components/ui";
import { RankBars } from "@/components/charts";
import { fmtNum, useAdminData } from "@/components/admin/data";

export function CatalogView() {
  const { data: s, error, loading, reload } = useAdminData("/api/admin/catalog");
  if (error) return <Alert tone="error" title="Couldn't load catalogue statistics">{error} <button onClick={reload} className="font-medium underline">Retry</button></Alert>;
  if (loading || !s) return <LoadingSkeleton rows={6} />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active products" value={fmtNum(s.products)} icon={<Package />} />
        <StatCard label="Archived products" value={fmtNum(s.archived)} icon={<Archive />} />
        <StatCard label="Barcodes" value={fmtNum(s.barcodes)} icon={<Barcode />} />
        <StatCard label="Accounts with products" value={fmtNum(s.accountsWithProducts)} icon={<Users />} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section id="barcodes" title="Barcodes by format"><RankBars data={s.byFormat} name="Barcodes" /></Section>
        <Section title="Barcode source" description="Generated internally vs. existing manufacturer codes"><RankBars data={s.bySource} name="Barcodes" /></Section>
        <Section id="inventory" title="Inventory movements" description="Transactions in the last 30 days, by type"><RankBars data={s.tx30} name="Transactions" /></Section>
        <Section title="Largest catalogues" description="Accounts by product count (for capacity planning)">
          {s.topAccounts.length ? (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {s.topAccounts.map((a: any) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{a.email || "Deleted account"} <span className="text-xs capitalize text-slate-400">· {a.plan}</span></span>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">{fmtNum(a.products)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-center text-sm text-slate-400">No products yet.</p>}
        </Section>
      </div>
    </div>
  );
}
