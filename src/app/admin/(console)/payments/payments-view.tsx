"use client";
import { Alert, Badge, FilterBar, Section, Select, StatCard } from "@/components/ui";
import { DataTable, Pagination, fmtDateTime, fmtInr, fmtNum, useAdminData, useListQuery, type Column, type Paged } from "@/components/admin/data";

interface Row { id: string; provider: string; providerRef: string; plan: string; amount: number; status: string; createdAt: string; user: { email: string } }
interface Resp extends Paged<Row> { billingConfigured: boolean; summary: { status: string; count: number; amountPaise: number }[] }

const TONE: Record<string, "green" | "amber" | "rose" | "slate"> = { paid: "green", created: "amber", failed: "rose", expired: "slate" };

export function PaymentsView() {
  const list = useListQuery("/api/admin/payments");
  const { data, loading, error, reload } = useAdminData<Resp>(list.url);
  const columns: Column<Row>[] = [
    { key: "createdAt", label: "Date", sortable: true, render: (p) => <span className="whitespace-nowrap text-xs">{fmtDateTime(p.createdAt)}</span> },
    { key: "user", label: "Account", render: (p) => <span className="block max-w-[220px] truncate">{p.user.email}</span> },
    { key: "plan", label: "Plan", render: (p) => <span className="capitalize">{p.plan}</span> },
    { key: "amount", label: "Amount", sortable: true, render: (p) => <span className="tabular-nums">{fmtInr(p.amount)}</span> },
    { key: "status", label: "Status", sortable: true, render: (p) => <Badge tone={TONE[p.status] || "slate"}>{p.status}</Badge> },
    { key: "ref", label: "Reference", hideSm: true, render: (p) => <span className="font-mono text-xs text-slate-500">{p.provider} · {p.providerRef}</span> },
  ];
  const paid = data?.summary.find((s) => s.status === "paid");
  return (
    <div className="space-y-6">
      {data && !data.billingConfigured && !data.total && (
        <Alert tone="info" title="No payment provider configured">Set the Razorpay key, secret and webhook secret to accept payments. No payment records exist yet.</Alert>
      )}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Verified revenue" value={fmtInr(paid?.amountPaise || 0)} hint={`${fmtNum(paid?.count)} paid`} />
          {["created", "failed", "expired"].map((st) => <StatCard key={st} label={st[0].toUpperCase() + st.slice(1)} value={fmtNum(data.summary.find((s) => s.status === st)?.count)} />)}
        </div>
      )}
      <Section title="Payment records" description={data ? `${fmtNum(data.total)} matching` : undefined}>
        <FilterBar>
          <Select aria-label="Filter by status" value={list.state.filters.status || ""} onChange={(e) => list.setFilter("status", e.target.value)} className="w-auto">
            <option value="">All statuses</option><option value="paid">Paid</option><option value="created">Created</option><option value="failed">Failed</option><option value="expired">Expired</option>
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
