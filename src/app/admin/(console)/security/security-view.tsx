"use client";
import { KeyRound, MonitorSmartphone, ShieldAlert, ShieldX } from "lucide-react";
import { Badge, SearchInput, Segmented } from "@/components/ui";
import { DataTable, Pagination, fmtDateTime, fmtNum, useAdminData, useListQuery, type Column, type Paged, TableView, MetricStrip, StripStat } from "@/components/admin/data";
import { ROLE_LABELS } from "@/lib/roles";

interface Row { id: string; actorId: string | null; actorEmail: string; action: string; targetType: string; targetId: string; details: string; ip: string; createdAt: string }
interface Admin { id: string; email: string; role: string; status: string; mfaEnabled: boolean; lastLoginAt: string | null }
interface Resp extends Paged<Row> { summary: { failed24h: number; mfaFailed24h: number; activeAdminSessions: number; admins: Admin[] } }

const tone = (a: string) => /failed|denied|blocked/.test(a) ? "rose" : a.startsWith("admin.") ? "amber" : "slate";

function Details({ raw }: { raw: string }) {
  if (!raw || raw === "{}") return <span className="text-slate-400">—</span>;
  return <code className="block max-w-[320px] truncate text-[11px] text-slate-500" title={raw}>{raw}</code>;
}

export type SecurityMode = "audit" | "events" | "admins";

export function SecurityView({ initialCategory, mode = "audit" }: { initialCategory: string; mode?: SecurityMode }) {
  const list = useListQuery("/api/admin/security", { filters: { category: initialCategory } });
  const { data, loading, error, reload } = useAdminData<Resp>(list.url);
  const s = data?.summary;
  const noMfa = s?.admins.filter((a) => !a.mfaEnabled && a.status === "active").length ?? 0;

  const columns: Column<Row>[] = [
    { key: "createdAt", label: "Time", render: (r) => <span className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</span> },
    { key: "action", label: "Event", render: (r) => <Badge tone={tone(r.action)}>{r.action}</Badge> },
    { key: "actor", label: "Actor", render: (r) => <span className="block max-w-[200px] truncate text-xs">{r.actorEmail || (r.actorId ? "account " + r.actorId.slice(-6) : "anonymous")}</span> },
    { key: "target", label: "Target", hideSm: true, render: (r) => r.targetType ? <span className="text-xs text-slate-500">{r.targetType}{r.targetId && ` · ${r.targetId.slice(-8)}`}</span> : <span className="text-slate-400">—</span> },
    { key: "details", label: "Details", hideSm: true, render: (r) => <Details raw={r.details} /> },
    { key: "ip", label: "IP (hashed)", hideSm: true, render: (r) => <span className="font-mono text-[11px] text-slate-400">{r.ip || "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      {s && mode !== "audit" && (
        <MetricStrip>
          <StripStat label="Failed sign-ins (24 h)" value={fmtNum(s.failed24h)} icon={<ShieldX />} tone={s.failed24h > 20 ? "warn" : undefined} />
          <StripStat label="Failed 2FA codes (24 h)" value={fmtNum(s.mfaFailed24h)} icon={<ShieldAlert />} tone={s.mfaFailed24h > 5 ? "warn" : undefined} />
          <StripStat label="Active admin sessions" value={fmtNum(s.activeAdminSessions)} icon={<MonitorSmartphone />} />
          <StripStat label="Admins without 2FA" value={fmtNum(noMfa)} icon={<KeyRound />} tone={noMfa ? "warn" : undefined} />
        </MetricStrip>
      )}

      {s && mode === "admins" && (
        <TableView title="Administrator accounts" count="Roles are granted only by a super administrator or the server-side admin CLI.">
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800" aria-label="Administrators">
            {s.admins.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" aria-hidden>{a.email.slice(0, 2).toUpperCase()}</span><span className="min-w-0 truncate font-medium">{a.email}</span></span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="amber">{ROLE_LABELS[a.role]}</Badge>
                  {a.mfaEnabled ? <Badge tone="green">2FA on</Badge> : <Badge tone="rose">2FA off</Badge>}
                  {a.status !== "active" && <Badge tone="rose">{a.status}</Badge>}
                  <span className="text-xs text-slate-400">last sign-in {fmtDateTime(a.lastLoginAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </TableView>
      )}

      {mode !== "admins" && <TableView title={mode === "events" ? "Security events" : "Audit log"} count={data ? `${fmtNum(data.total)} events` : undefined}
          toolbar={<>
          <Segmented size="sm" value={list.state.filters.category || ""} onChange={(v) => list.setFilter("category", v)}
            options={[{ value: "", label: "All" }, { value: "admin", label: "Admin actions" }, { value: "auth", label: "Sign-in" }, { value: "failures", label: "Failures" }]} />
          <SearchInput value={list.state.q} onChange={list.setQ} placeholder="Event, actor or target" aria-label="Search audit log" className="sm:w-64" />
          </>}
          footer={data && data.total > 0 && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} onPageSize={list.setPageSize} />}>
          <DataTable caption="Audit log" columns={columns} data={data?.items} loading={loading} error={error} onRetry={reload} empty={{ title: "No events match" }} />
      </TableView>}
    </div>
  );
}
