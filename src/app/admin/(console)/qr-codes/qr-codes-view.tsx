"use client";
import { useState } from "react";
import { Ban, ExternalLink, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, ConfirmDialog, SearchInput, Select } from "@/components/ui";
import { DataTable, Pagination, RowMenu, TableView, fmtDate, fmtNum, useAdminApi, useAdminData, useListQuery, type Column, type Paged } from "@/components/admin/data";

interface Row {
  id: string; name: string; type: string; shortCode: string; destination: string; isHosted: boolean; status: string; expiresAt: string | null; createdAt: string;
  user: { email: string; status: string }; _count: { scans: number };
}

const TONE: Record<string, "green" | "amber" | "rose"> = { active: "green", paused: "amber", disabled: "rose" };

export function QrCodesView() {
  const call = useAdminApi();
  const list = useListQuery("/api/admin/qrcodes");
  const { data, loading, error, reload } = useAdminData<Paged<Row> & { staticCount: number }>(list.url);
  const [pending, setPending] = useState<{ row: Row; action: "active" | "paused" | "disabled" | "delete" } | null>(null);

  const apply = async () => {
    if (!pending) return;
    const { row, action } = pending;
    try {
      if (action === "delete") await call(`/api/admin/qrcodes/${row.id}`, { method: "DELETE" });
      else await call(`/api/admin/qrcodes/${row.id}`, { method: "PATCH", json: { status: action } });
      toast.success(action === "delete" ? "QR code deleted" : `QR code ${action === "active" ? "re-enabled" : action}`);
      setPending(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "name", label: "Code", sortable: true, render: (q) => (
        <div className="min-w-0 max-w-[220px]">
          <p className="truncate font-medium">{q.name}</p>
          <p className="font-mono text-xs text-slate-500">/{q.isHosted ? "p" : "r"}/{q.shortCode}</p>
        </div>
      ),
    },
    { key: "type", label: "Type", sortable: true, render: (q) => <Badge tone={q.isHosted ? "violet" : "blue"}>{q.isHosted ? "Hosted" : "Redirect"} · {q.type}</Badge> },
    {
      key: "destination", label: "Destination", hideSm: true, render: (q) => q.isHosted ? <span className="text-xs text-slate-500">Hosted page</span> : (
        <span className="block max-w-[260px] truncate text-xs text-slate-600 dark:text-slate-300" title={q.destination}>{q.destination}</span>
      ),
    },
    { key: "owner", label: "Owner", hideSm: true, render: (q) => <span className="block max-w-[180px] truncate text-xs">{q.user.email}{q.user.status !== "active" && <Badge tone="rose" className="ml-1">suspended</Badge>}</span> },
    { key: "scans", label: "Scans", render: (q) => <span className="tabular-nums">{fmtNum(q._count.scans)}</span> },
    { key: "status", label: "Status", sortable: true, render: (q) => <Badge tone={TONE[q.status] || "slate"}>{q.status}</Badge> },
    { key: "createdAt", label: "Created", sortable: true, hideSm: true, render: (q) => <span className="whitespace-nowrap text-xs">{fmtDate(q.createdAt)}</span> },
    {
      key: "actions", label: <span className="sr-only">Actions</span>, className: "text-right", render: (q) => (
        <RowMenu label={`Actions for /${q.shortCode}`} items={[
          { label: "Open public link", icon: ExternalLink, href: `/${q.isHosted ? "p" : "r"}/${q.shortCode}`, external: true, title: "Counts as a scan" },
          { label: "Pause", icon: Pause, onClick: () => setPending({ row: q, action: "paused" }), hidden: q.status !== "active" },
          { label: "Re-enable", icon: Play, onClick: () => setPending({ row: q, action: "active" }), hidden: q.status === "active" },
          { label: "Disable (abuse)", icon: Ban, onClick: () => setPending({ row: q, action: "disabled" }), hidden: q.status === "disabled", danger: true },
          { label: "Delete", icon: Trash2, onClick: () => setPending({ row: q, action: "delete" }), danger: true },
        ]} />
      ),
    },
  ];

  const verb = pending?.action === "delete" ? "Delete" : pending?.action === "disabled" ? "Disable" : pending?.action === "paused" ? "Pause" : "Re-enable";
  return (
    <TableView title="Dynamic & hosted codes" count={data ? `${fmtNum(data.total)} matching · ${fmtNum(data.staticCount)} static not listed` : undefined}
      footer={data && data.total > 0 && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} onPageSize={list.setPageSize} />}
      toolbar={<>
        <SearchInput value={list.state.q} onChange={list.setQ} placeholder="Short code, name, destination or owner" aria-label="Search QR codes" className="sm:w-72" />
        <Select aria-label="Filter by status" value={list.state.filters.status || ""} onChange={(e) => list.setFilter("status", e.target.value)} className="sm:w-auto">
          <option value="">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="disabled">Disabled</option>
        </Select>
        <Select aria-label="Filter by kind" value={list.state.filters.kind || ""} onChange={(e) => list.setFilter("kind", e.target.value)} className="sm:w-auto">
          <option value="">Redirects & hosted</option><option value="redirect">Redirects</option><option value="hosted">Hosted pages</option>
        </Select>
      </>}>
      <DataTable caption="QR codes" columns={columns} data={data?.items} loading={loading} error={error} onRetry={reload}
        sort={list.state.sort} order={list.state.order} onSort={list.toggleSort}
        empty={{ title: "No dynamic or hosted codes match" }} />
      <ConfirmDialog open={!!pending} onClose={() => setPending(null)} onConfirm={apply} tone={pending?.action === "active" ? "primary" : "danger"}
        title={`${verb} /${pending?.row.shortCode}?`} confirmLabel={verb}>
        {pending?.action === "delete" && "The code and its scan history are deleted permanently. Printed copies will show “not found”."}
        {pending?.action === "disabled" && "Visitors will see a “disabled” notice instead of the destination. Use this for abuse; the owner can't re-enable it."}
        {pending?.action === "paused" && "Visitors will see a “paused” notice until it's re-enabled."}
        {pending?.action === "active" && "The code will redirect to its destination again."}
      </ConfirmDialog>
    </TableView>
  );
}
