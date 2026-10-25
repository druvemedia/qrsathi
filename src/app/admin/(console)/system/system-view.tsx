"use client";
import { CheckCircle2, Database, HardDrive, RefreshCw, Timer, XCircle } from "lucide-react";
import { Alert, Badge, Button, FilterBar, LoadingSkeleton, SearchInput, Section, Segmented, StatCard } from "@/components/ui";
import { DataTable, Pagination, fmtDateTime, fmtNum, useAdminData, useListQuery, type Column, type Paged } from "@/components/admin/data";

function OnOff({ on, warnWhen }: { on: boolean; warnWhen?: boolean }) {
  return on
    ? <Badge tone={warnWhen === true ? "amber" : "green"}><CheckCircle2 className="h-3 w-3" /> on</Badge>
    : <Badge tone={warnWhen === false ? "amber" : "slate"}><XCircle className="h-3 w-3" /> off</Badge>;
}

const uptime = (s: number) => s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} days`;

interface LogRow { id: string; level: string; event: string; message: string; createdAt: string }

export function SystemView() {
  const { data: s, error, loading, reload } = useAdminData("/api/admin/system");
  const logs = useListQuery("/api/admin/logs");
  const logData = useAdminData<Paged<LogRow>>(logs.url);
  const prod = s?.environment === "production";

  const logCols: Column<LogRow>[] = [
    { key: "createdAt", label: "Time", render: (l) => <span className="whitespace-nowrap text-xs">{fmtDateTime(l.createdAt)}</span> },
    { key: "level", label: "Level", render: (l) => <Badge tone={l.level === "error" ? "rose" : l.level === "warn" ? "amber" : "slate"}>{l.level}</Badge> },
    { key: "event", label: "Event", render: (l) => <span className="font-mono text-xs">{l.event}</span> },
    { key: "message", label: "Message", render: (l) => <span className="block max-w-[420px] truncate text-xs text-slate-600 dark:text-slate-300" title={l.message}>{l.message}</span> },
  ];

  return (
    <div className="space-y-6">
      {error ? <Alert tone="error" title="Couldn't load system status">{error}</Alert> : loading || !s ? <LoadingSkeleton rows={6} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Database" value={s.database.ok ? "Healthy" : "Unreachable"} hint={`${s.database.provider} · ${s.database.latencyMs} ms`} icon={<Database />} tone={s.database.ok ? undefined : "warn"} />
            <StatCard label="Upload storage" value={s.storage.ok ? "Writable" : "Not writable"} icon={<HardDrive />} tone={s.storage.ok ? undefined : "warn"} />
            <StatCard label="Uptime" value={uptime(s.uptimeSec)} hint={`Node ${s.node}`} icon={<Timer />} />
            <StatCard label="Environment" value={s.environment} hint={`App v${s.version}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Configuration" description="Set with environment variables — see .env.example and docs/DEPLOYMENT.md."
              actions={<Button size="sm" variant="outline" onClick={reload}><RefreshCw className="h-3.5 w-3.5" /> Re-check</Button>}>
              <ul className="space-y-2 text-sm">
                {([
                  ["Public URL set (NEXT_PUBLIC_APP_URL)", s.config.appUrlSet, prod ? false : undefined],
                  ["Public URL uses HTTPS", s.config.appUrlHttps, prod ? false : undefined],
                  ["Strong AUTH_SECRET", s.config.authSecretStrong, false],
                  ["Dedicated MFA_ENCRYPTION_KEY", s.config.mfaKeySet, undefined],
                  ["E-mail (SMTP)", s.config.smtp, undefined],
                  ["Google sign-in", s.config.google, undefined],
                  [`Razorpay checkout (${s.config.razorpayMode} mode)`, s.config.razorpay, undefined],
                  ["Razorpay webhook secret (active mode)", s.config.razorpayWebhook, s.config.razorpay ? false : undefined],
                  ["SETTINGS_ENCRYPTION_KEY (DB-stored credentials)", s.config.settingsKeySet, undefined],
                  ["Demo mode", s.config.demoMode, true],
                ] as [string, boolean, boolean | undefined][]).map(([k, v, w]) => (
                  <li key={k} className="flex items-center justify-between gap-3"><span>{k}</span><OnOff on={v} warnWhen={w} /></li>
                ))}
                <li className="flex items-center justify-between gap-3"><span>Trusted proxy (TRUST_PROXY)</span><Badge>{s.config.trustProxy}</Badge></li>
                <li className="flex items-center justify-between gap-3"><span>Rate-limit store</span><Badge tone={prod && s.config.rateLimitStore === "memory" ? "amber" : "slate"}>{s.config.rateLimitStore}</Badge></li>
              </ul>
              {s.config.adminEmailsVariableSet && (
                <Alert tone="warn" className="mt-4" title="ADMIN_EMAILS is set but no longer used">Administrator access is granted only with the admin CLI or by a super administrator. Remove the variable.</Alert>
              )}
            </Section>
            <Section title="Records">
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {Object.entries(s.records as Record<string, number>).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-2"><span className="text-slate-500">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</span><span className="tabular-nums">{fmtNum(v)}</span></li>
                ))}
              </ul>
            </Section>
          </div>
        </>
      )}

      <Section title="Application log" description="Warnings and errors. Messages are redacted when written.">
        <FilterBar>
          <Segmented size="sm" value={logs.state.filters.level || ""} onChange={(v) => logs.setFilter("level", v)}
            options={[{ value: "", label: "All" }, { value: "error", label: "Errors" }, { value: "warn", label: "Warnings" }, { value: "info", label: "Info" }]} />
          <SearchInput value={logs.state.q} onChange={logs.setQ} placeholder="Search events" aria-label="Search log" className="w-full sm:w-64" />
        </FilterBar>
        <div className="mt-4">
          <DataTable caption="Application log" columns={logCols} data={logData.data?.items} loading={logData.loading} error={logData.error} onRetry={logData.reload} empty={{ title: "No log entries" }} />
          {logData.data && <Pagination page={logData.data.page} pages={logData.data.pages} total={logData.data.total} pageSize={logData.data.pageSize} onPage={logs.setPage} onPageSize={logs.setPageSize} />}
        </div>
      </Section>
    </div>
  );
}
