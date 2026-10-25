"use client";
import { useState } from "react";
import { Ban, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, ConfirmDialog, FilterBar, Section, Segmented } from "@/components/ui";
import { DataTable, Pagination, fmtDateTime, fmtNum, useAdminApi, useAdminData, useListQuery, type Column, type Paged } from "@/components/admin/data";

interface Row {
  id: string; shortCode: string; url: string; reason: string; details: string; status: string; createdAt: string;
  qr: null | { id: string; name: string; status: string; destination: string; isHosted: boolean; user: { id: string; email: string; status: string; role: string } };
}

export function ReportsView() {
  const call = useAdminApi();
  const list = useListQuery("/api/admin/reports", { filters: { status: "open" } });
  const { data, loading, error, reload } = useAdminData<Paged<Row>>(list.url);
  const [pending, setPending] = useState<{ row: Row; kind: "disable" | "suspend" | "resolved" | "dismissed" } | null>(null);

  const apply = async () => {
    if (!pending) return;
    const { row, kind } = pending;
    try {
      if (kind === "disable" && row.qr) {
        await call(`/api/admin/qrcodes/${row.qr.id}`, { method: "PATCH", json: { status: "disabled" } });
        await call(`/api/admin/reports/${row.id}`, { method: "PATCH", json: { status: "resolved" } });
      } else if (kind === "suspend" && row.qr) {
        await call(`/api/admin/users/${row.qr.user.id}`, { method: "PATCH", json: { status: "suspended" } });
        await call(`/api/admin/reports/${row.id}`, { method: "PATCH", json: { status: "resolved" } });
      } else {
        await call(`/api/admin/reports/${row.id}`, { method: "PATCH", json: { status: kind } });
      }
      toast.success("Report updated");
      setPending(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const columns: Column<Row>[] = [
    { key: "code", label: "Code", render: (r) => r.shortCode ? <span className="font-mono text-xs">/{r.shortCode}</span> : <span className="block max-w-[160px] truncate text-xs" title={r.url}>{r.url || "—"}</span> },
    {
      key: "reason", label: "Report", render: (r) => (
        <div className="max-w-[320px]">
          <Badge tone="rose">{r.reason}</Badge>
          {r.details && <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{r.details}</p>}
        </div>
      ),
    },
    {
      key: "target", label: "Target", hideSm: true, render: (r) => r.qr ? (
        <div className="max-w-[240px] text-xs">
          <p className="truncate" title={r.qr.destination}>{r.qr.isHosted ? "Hosted page" : r.qr.destination}</p>
          <p className="truncate text-slate-500">{r.qr.user.email} · code {r.qr.status}{r.qr.user.status !== "active" && " · owner suspended"}</p>
        </div>
      ) : <span className="text-xs text-slate-400">Code no longer exists</span>,
    },
    { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "open" ? "amber" : r.status === "resolved" ? "green" : "slate"}>{r.status}</Badge> },
    { key: "createdAt", label: "Received", hideSm: true, render: (r) => <span className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</span> },
    {
      key: "actions", label: <span className="sr-only">Actions</span>, className: "text-right", render: (r) => r.status !== "open" ? null : (
        <div className="flex flex-wrap justify-end gap-1">
          {r.qr && r.qr.status !== "disabled" && <Button size="sm" variant="outline" onClick={() => setPending({ row: r, kind: "disable" })}><Ban className="h-3.5 w-3.5 text-rose-500" /> Disable code</Button>}
          {r.qr && r.qr.user.status === "active" && r.qr.user.role === "user" && <Button size="sm" variant="outline" onClick={() => setPending({ row: r, kind: "suspend" })}>Suspend owner</Button>}
          <Button size="sm" variant="ghost" onClick={() => setPending({ row: r, kind: "resolved" })} aria-label="Mark resolved" title="Mark resolved"><CheckCircle2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setPending({ row: r, kind: "dismissed" })} aria-label="Dismiss" title="Dismiss"><XCircle className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const titles = { disable: "Disable this code and resolve?", suspend: "Suspend the owner and resolve?", resolved: "Mark as resolved?", dismissed: "Dismiss this report?" };
  return (
    <Section title="Reports" description={data ? `${fmtNum(data.total)} ${list.state.filters.status || "total"}` : undefined}>
      <FilterBar>
        <Segmented value={list.state.filters.status || ""} onChange={(v) => list.setFilter("status", v)}
          options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }, { value: "dismissed", label: "Dismissed" }, { value: "", label: "All" }]} />
      </FilterBar>
      <div className="mt-4">
        <DataTable caption="Abuse reports" columns={columns} data={data?.items} loading={loading} error={error} onRetry={reload}
          empty={{ title: list.state.filters.status === "open" ? "No open reports" : "No reports", body: list.state.filters.status === "open" ? "Nothing needs review right now." : undefined }} />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} onPageSize={list.setPageSize} />}
      </div>
      <ConfirmDialog open={!!pending} onClose={() => setPending(null)} onConfirm={apply} tone={pending?.kind === "resolved" || pending?.kind === "dismissed" ? "primary" : "danger"}
        title={pending ? titles[pending.kind] : ""} confirmLabel="Confirm">
        {pending?.kind === "disable" && "Visitors to this code will see a “disabled” notice. The owner can't re-enable it."}
        {pending?.kind === "suspend" && `${pending.row.qr?.user.email} will be signed out and blocked from signing in.`}
        {(pending?.kind === "resolved" || pending?.kind === "dismissed") && "No change is made to the code or its owner."}
      </ConfirmDialog>
    </Section>
  );
}
