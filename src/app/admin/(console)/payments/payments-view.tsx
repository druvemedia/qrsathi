"use client";
import { Alert, Badge, FilterBar, SearchInput, Section, Select, StatCard } from "@/components/ui";
import { DataTable, Pagination, fmtDateTime, fmtNum, useAdminData, useListQuery, type Column, type Paged } from "@/components/admin/data";
import { formatMoney } from "@/lib/plans";

interface Row {
  id: string; createdAt: string; email: string; kind: string; plan: string; planName: string; interval: string; amount: number; currency: string;
  status: string; refundedAmount: number; failureReason: string; provider: string; providerRef: string;
}
interface Resp extends Paged<Row> {
  billingConfigured: boolean; mode: string;
  summary: { status: string; currency: string; count: number; amount: number }[];
  netCollected: { currency: string; amount: number }[];
}

const TONE: Record<string, "green" | "amber" | "rose" | "slate"> = { paid: "green", pending: "amber", created: "amber", failed: "rose", expired: "slate", refunded: "slate", partially_refunded: "amber" };
const count = (d: Resp, st: string) => d.summary.filter((s) => s.status === st).reduce((a, s) => a + s.count, 0);

export function PaymentsView() {
  const list = useListQuery("/api/admin/payments");
  const { data, loading, error, reload } = useAdminData<Resp>(list.url);
  const columns: Column<Row>[] = [
    { key: "createdAt", label: "Date", sortable: true, render: (p) => <span className="whitespace-nowrap text-xs">{fmtDateTime(p.createdAt)}</span> },
    { key: "user", label: "Customer", render: (p) => <span className="block max-w-[220px] truncate">{p.email}</span> },
    { key: "plan", label: "Plan", render: (p) => <span>{p.planName || p.plan}{p.interval && <span className="text-xs text-slate-500"> · {p.interval === "year" ? "yearly" : "monthly"}</span>}{p.kind === "payment_link" && <span className="text-xs text-slate-500"> · 30-day pass</span>}</span> },
    { key: "amount", label: "Amount", sortable: true, render: (p) => <span className="tabular-nums">{formatMoney(p.amount, p.currency)}{p.refundedAmount > 0 && <span className="block text-xs text-slate-500">refunded {formatMoney(p.refundedAmount, p.currency)}</span>}</span> },
    { key: "status", label: "Status", sortable: true, render: (p) => <span title={p.failureReason || undefined}><Badge tone={TONE[p.status] || "slate"}>{p.status.replace("_", " ")}</Badge></span> },
    { key: "ref", label: "Reference", hideSm: true, render: (p) => <span className="font-mono text-xs text-slate-500">{p.providerRef}</span> },
  ];
  return (
    <div className="space-y-6">
      {data && !data.billingConfigured && !data.total && <Alert tone="info" title="No payments yet">Online checkout is off. Configure Razorpay under Payment gateway to accept payments.</Alert>}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Net collected (confirmed)" value={data.netCollected.length ? data.netCollected.map((n) => formatMoney(n.amount, n.currency)).join(" · ") : "—"} hint="Paid minus refunds" />
          <StatCard label="Paid payments" value={fmtNum(count(data, "paid") + count(data, "partially_refunded"))} />
          <StatCard label="Failed" value={fmtNum(count(data, "failed"))} tone={count(data, "failed") ? "warn" : undefined} />
          <StatCard label="Refunded" value={fmtNum(count(data, "refunded") + count(data, "partially_refunded"))} />
        </div>
      )}
      <Section title="Payment history" description={data ? `${fmtNum(data.total)} matching` : undefined}>
        <FilterBar>
          <SearchInput value={list.state.q} onChange={list.setQ} placeholder="Customer e-mail or pay_ id" aria-label="Search payments" className="w-full sm:w-64" />
          <Select aria-label="Filter by status" value={list.state.filters.status || ""} onChange={(e) => list.setFilter("status", e.target.value)} className="w-auto">
            <option value="">All statuses</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option><option value="partially_refunded">Partially refunded</option><option value="created">Created (legacy link)</option>
          </Select>
        </FilterBar>
        <div className="mt-4">
          <DataTable caption="Payments" columns={columns} data={data?.items} loading={loading} error={error} onRetry={reload}
            sort={list.state.sort} order={list.state.order} onSort={list.toggleSort} empty={{ title: "No payments recorded" }} />
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} onPageSize={list.setPageSize} />}
        </div>
      </Section>
    </div>
  );
}
