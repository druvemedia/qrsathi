"use client";
import { Alert, Badge, FilterBar, Section, Select, StatCard } from "@/components/ui";
import { DataTable, Pagination, fmtDate, fmtNum, useAdminData, useListQuery, type Column, type Paged } from "@/components/admin/data";

interface Row { id: string; email: string; name: string; plan: string; planExpiresAt: string | null; status: string }
interface Resp extends Paged<Row> {
  plans: { id: string; name: string; priceInr: number; users: number }[];
  billingConfigured: boolean; expiringSoon: number; adminAssigned: number;
}

export function SubscriptionsView() {
  const list = useListQuery("/api/admin/subscriptions", { sort: "planExpiresAt", order: "asc" });
  const { data, loading, error, reload } = useAdminData<Resp>(list.url);
  const columns: Column<Row>[] = [
    { key: "email", label: "Account", render: (u) => <div className="min-w-0 max-w-[260px]"><p className="truncate font-medium">{u.name || "—"}</p><p className="truncate text-xs text-slate-500">{u.email}</p></div> },
    { key: "plan", label: "Plan", render: (u) => <Badge tone="brand" className="capitalize">{u.plan}</Badge> },
    { key: "renews", label: "Paid until", render: (u) => u.planExpiresAt ? <span className="text-xs">{fmtDate(u.planExpiresAt)}</span> : <span className="text-xs text-slate-500">No expiry (assigned by admin)</span> },
    { key: "status", label: "Account", render: (u) => <Badge tone={u.status === "active" ? "green" : "rose"}>{u.status}</Badge> },
  ];
  return (
    <div className="space-y-6">
      {data && !data.billingConfigured && (
        <Alert tone="info" title="Online billing isn't configured">Razorpay keys aren&apos;t set, so customers can&apos;t pay online. Paid plans shown here were assigned by an administrator.</Alert>
      )}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {data.plans.map((p) => <StatCard key={p.id} label={`${p.name} plan`} value={fmtNum(p.users)} hint={p.priceInr ? `₹${p.priceInr}/month` : "Free"} />)}
          <StatCard label="Expiring in 7 days" value={fmtNum(data.expiringSoon)} tone={data.expiringSoon ? "warn" : undefined} />
          <StatCard label="Admin-assigned" value={fmtNum(data.adminAssigned)} hint="Paid plan without expiry" />
        </div>
      )}
      <Section title="Paid accounts" description={data ? `${fmtNum(data.total)} accounts` : undefined}>
        <FilterBar>
          <Select aria-label="Filter by plan" value={list.state.filters.plan || ""} onChange={(e) => list.setFilter("plan", e.target.value)} className="w-auto">
            <option value="">All paid plans</option><option value="pro">Pro</option><option value="business">Business</option>
          </Select>
        </FilterBar>
        <div className="mt-4">
          <DataTable caption="Paid accounts" columns={columns} data={data?.items} loading={loading} error={error} onRetry={reload} empty={{ title: "No accounts on paid plans" }} />
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} onPageSize={list.setPageSize} />}
        </div>
      </Section>
    </div>
  );
}
