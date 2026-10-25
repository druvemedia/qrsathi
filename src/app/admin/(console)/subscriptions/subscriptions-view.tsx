"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, Badge, Button, ConfirmDialog, FilterBar, SearchInput, Section, Select, StatCard } from "@/components/ui";
import { DataTable, Pagination, fmtDate, fmtNum, useAdminApi, useAdminData, useListQuery, type Column, type Paged } from "@/components/admin/data";
import { formatMoney } from "@/lib/plans";

interface Row {
  id: string; email: string; userStatus: string; planId: string; planName: string; interval: string; amount: number; currency: string;
  status: string; mode: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; providerSubscriptionId: string; createdAt: string;
}
interface Resp extends Paged<Row> {
  plans: { id: string; name: string; status: string; users: number }[];
  byStatus: { status: string; count: number }[];
  renewingSoon: number; adminAssigned: number; billingConfigured: boolean;
}

const TONE: Record<string, "green" | "amber" | "rose" | "slate" | "blue"> = { active: "green", authenticated: "blue", created: "slate", pending: "amber", halted: "rose", cancelled: "slate", completed: "slate", expired: "slate" };

export function SubscriptionsView({ canManage }: { canManage: boolean }) {
  const call = useAdminApi();
  const list = useListQuery("/api/admin/subscriptions");
  const { data, loading, error, reload } = useAdminData<Resp>(list.url);
  const [cancel, setCancel] = useState<null | { row: Row; atPeriodEnd: boolean }>(null);

  const doCancel = async () => {
    if (!cancel) return;
    try {
      await call(`/api/admin/subscriptions/${cancel.row.id}`, { method: "POST", json: { action: "cancel", atPeriodEnd: cancel.atPeriodEnd } });
      toast.success(cancel.atPeriodEnd ? "Cancellation scheduled at period end" : "Subscription cancelled");
      setCancel(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't cancel");
    }
  };

  const columns: Column<Row>[] = [
    { key: "email", label: "Customer", render: (r) => <div className="max-w-[240px]"><p className="truncate">{r.email}</p><p className="font-mono text-[11px] text-slate-400">{r.providerSubscriptionId}</p></div> },
    { key: "plan", label: "Plan", render: (r) => <span>{r.planName || r.planId} <span className="text-xs text-slate-500">· {r.interval === "year" ? "yearly" : "monthly"}</span></span> },
    { key: "amount", label: "Amount", render: (r) => <span className="tabular-nums">{formatMoney(r.amount, r.currency)}</span> },
    { key: "status", label: "Status", render: (r) => <span className="flex flex-wrap gap-1"><Badge tone={TONE[r.status] || "slate"}>{r.status}</Badge>{r.cancelAtPeriodEnd && <Badge tone="amber">ends at period end</Badge>}{r.mode === "test" && <Badge>test</Badge>}</span> },
    { key: "period", label: "Period ends", hideSm: true, render: (r) => <span className="text-xs">{fmtDate(r.currentPeriodEnd)}</span> },
    {
      key: "actions", label: <span className="sr-only">Actions</span>, className: "text-right", render: (r) => canManage && ["active", "authenticated", "pending"].includes(r.status) ? (
        <div className="flex justify-end gap-1">
          {!r.cancelAtPeriodEnd && <Button size="sm" variant="outline" onClick={() => setCancel({ row: r, atPeriodEnd: true })}>Cancel at period end</Button>}
          <Button size="sm" variant="ghost" onClick={() => setCancel({ row: r, atPeriodEnd: false })}>Cancel now</Button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {data && !data.billingConfigured && <Alert tone="info" title="Online checkout is off">Customers can&apos;t start subscriptions until Razorpay is configured and enabled under Payment gateway. Paid plans on accounts without a subscription were assigned by an administrator.</Alert>}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active subscriptions" value={fmtNum(data.byStatus.find((s) => s.status === "active")?.count)} />
          <StatCard label="Payment problems" value={fmtNum((data.byStatus.find((s) => s.status === "pending")?.count ?? 0) + (data.byStatus.find((s) => s.status === "halted")?.count ?? 0))} hint="Pending or halted" tone={(data.byStatus.find((s) => s.status === "halted")?.count ?? 0) ? "warn" : undefined} />
          <StatCard label="Renewing in 7 days" value={fmtNum(data.renewingSoon)} />
          <StatCard label="Admin-assigned paid plans" value={fmtNum(data.adminAssigned)} hint="No active subscription" />
        </div>
      )}
      {data && (
        <Section title="Accounts per plan">
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {data.plans.map((p) => <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"><span>{p.name} {p.status !== "published" && <Badge>{p.status}</Badge>}</span><span className="tabular-nums">{fmtNum(p.users)}</span></li>)}
          </ul>
        </Section>
      )}
      <Section title="Subscriptions" description={data ? `${fmtNum(data.total)} matching` : undefined}>
        <FilterBar>
          <SearchInput value={list.state.q} onChange={list.setQ} placeholder="Customer e-mail or sub_ id" aria-label="Search subscriptions" className="w-full sm:w-64" />
          <Select aria-label="Filter by status" value={list.state.filters.status || ""} onChange={(e) => list.setFilter("status", e.target.value)} className="w-auto">
            <option value="">All statuses</option><option value="live">Active / pending</option><option value="active">Active</option><option value="pending">Pending</option><option value="halted">Halted</option><option value="cancelled">Cancelled</option><option value="created">Checkout started</option>
          </Select>
          <Select aria-label="Filter by plan" value={list.state.filters.plan || ""} onChange={(e) => list.setFilter("plan", e.target.value)} className="w-auto">
            <option value="">All plans</option>{data?.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FilterBar>
        <div className="mt-4">
          <DataTable caption="Subscriptions" columns={columns} data={data?.items} loading={loading} error={error} onRetry={reload} empty={{ title: "No subscriptions yet" }} />
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} onPageSize={list.setPageSize} />}
        </div>
      </Section>
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} title={cancel?.atPeriodEnd ? "Cancel at the end of the period?" : "Cancel immediately?"} confirmLabel="Cancel subscription" onConfirm={doCancel}>
        {cancel?.atPeriodEnd ? `${cancel.row.email} keeps ${cancel.row.planName} until the current period ends; Razorpay won't charge again.` : `${cancel?.row.email} loses paid access now and Razorpay stops charging. No automatic refund is made.`}
      </ConfirmDialog>
    </div>
  );
}
