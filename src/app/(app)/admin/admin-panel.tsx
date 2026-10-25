"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertOctagon, Ban, CheckCircle2, Flag, Gauge, Link2, RefreshCw, ScrollText, Search, Settings, Trash2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { formatDate, formatNumber, truncate } from "@/lib/utils";
import { BRAND_COLORS } from "@/lib/brand";
import { getType } from "@/lib/qr-types";
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, Skeleton, StatCard, Switch, Tabs, Textarea } from "@/components/ui";
import { ColumnChart, RankBars } from "@/components/charts";
import { useApp } from "@/components/providers";

type Tab = "overview" | "users" | "redirects" | "reports" | "payments" | "logs" | "settings";

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="space-y-6">
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "overview", label: "Overview", icon: <Gauge className="h-4 w-4" /> },
        { value: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
        { value: "redirects", label: "Redirects", icon: <Link2 className="h-4 w-4" /> },
        { value: "reports", label: "Abuse reports", icon: <Flag className="h-4 w-4" /> },
        { value: "payments", label: "Payments", icon: <Wallet className="h-4 w-4" /> },
        { value: "logs", label: "Logs", icon: <ScrollText className="h-4 w-4" /> },
        { value: "settings", label: "Site settings", icon: <Settings className="h-4 w-4" /> },
      ]} />
      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab />}
      {tab === "redirects" && <RedirectsTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "logs" && <LogsTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

function useList<T>(url: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const reload = useCallback(() => {
    api<{ items: T[] }>(url).then((r) => setItems(r.items)).catch((e) => toast.error(e.message));
  }, [url]);
  useEffect(reload, [reload]);
  return { items, reload, setItems };
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-2.5">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

function SearchBar({ value, onChange, children }: { value: string; onChange: (v: string) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search…" className="py-2 pl-9" aria-label="Search" />
      </div>
      {children}
    </div>
  );
}

function useDebounced(v: string, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function Overview() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api("/api/admin/stats").then(setS).catch((e) => toast.error(e.message)); }, []);
  if (!s) return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Users" value={formatNumber(s.users)} hint={`+${s.newUsers} in 30 days · ${s.suspended} suspended`} />
        <StatCard label="QR codes saved" value={formatNumber(s.qrs)} hint={`${s.dynamic} dynamic · ${s.hosted} hosted`} />
        <StatCard label="Scans" value={formatNumber(s.scans)} hint={`${formatNumber(s.scans30)} in 30 days`} />
        <StatCard label="Downloads (signed-in)" value={formatNumber(s.downloads)} />
        <StatCard label="Open abuse reports" value={s.openReports} hint={s.openReports ? "Review in Abuse reports" : "All clear"} />
        <StatCard label="Errors (24h)" value={s.errors24h} hint="See Logs" />
        <StatCard label="Verified revenue" value={`₹${formatNumber(s.revenuePaise / 100)}`} hint={`${s.paidCount} provider-confirmed payments`} />
        <StatCard label="Paid plans" value={s.byPlan.filter((p: any) => p.name !== "free").reduce((a: number, p: any) => a + p.value, 0)} hint={s.byPlan.map((p: any) => `${p.name}: ${p.value}`).join(" · ")} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display font-bold">QR codes saved per day</h3>
          <p className="text-xs text-slate-500">Last 30 days (signed-in saves; guest downloads aren&apos;t tracked)</p>
          <div className="mt-3"><ColumnChart data={s.qrDaily} xKey="date" yKey="count" name="QR codes" tickFormat={(d: string) => d?.slice(5)} /></div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-display font-bold">Most-used QR types</h3>
          <RankBars data={s.byType.map((t: any) => ({ ...t, name: getType(t.name).label }))} name="QR codes" />
        </Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const { user: me } = useApp();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const dq = useDebounced(q);
  const { items, reload } = useList<any>(`/api/admin/users?q=${encodeURIComponent(dq)}&status=${status}`);
  const [del, setDel] = useState<any>(null);
  const patch = async (id: string, body: Record<string, string>) => {
    try { await api(`/api/admin/users/${id}`, { method: "PATCH", json: body }); toast.success("User updated"); reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  return (
    <div className="space-y-4">
      <SearchBar value={q} onChange={setQ}>
        <Select className="w-auto py-2" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></Select>
      </SearchBar>
      {!items ? <Skeleton className="h-64" /> : (
        <Table head={["User", "Plan", "Role", "Status", "QR codes", "Joined", "Last login", ""]}>
          {items.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2.5"><p className="font-medium">{u.name || "—"}</p><p className="text-xs text-slate-500">{u.email}{u.google && " · Google"}</p></td>
              <td className="px-4 py-2.5">
                <Select className="w-28 py-1 text-xs" value={u.plan} onChange={(e) => patch(u.id, { plan: e.target.value })} aria-label="Plan"><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option></Select>
                {u.planExpiresAt && <p className="mt-0.5 text-[10px] text-slate-500">until {formatDate(u.planExpiresAt)}</p>}
              </td>
              <td className="px-4 py-2.5">
                <Select className="w-24 py-1 text-xs" value={u.role} disabled={u.id === me?.id} onChange={(e) => patch(u.id, { role: e.target.value })} aria-label="Role"><option value="user">User</option><option value="admin">Admin</option></Select>
              </td>
              <td className="px-4 py-2.5">{u.status === "active" ? <Badge tone="green">Active</Badge> : <Badge tone="rose">Suspended</Badge>}</td>
              <td className="px-4 py-2.5 tabular-nums">{u._count.qrCodes}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{formatDate(u.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{u.lastLoginAt ? formatDate(u.lastLoginAt, true) : "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                {u.id !== me?.id && (
                  <div className="flex justify-end gap-1">
                    {u.status === "active"
                      ? <Button size="sm" variant="outline" onClick={() => patch(u.id, { status: "suspended" })}><Ban className="h-3.5 w-3.5" /> Suspend</Button>
                      : <Button size="sm" variant="outline" onClick={() => patch(u.id, { status: "active" })}><CheckCircle2 className="h-3.5 w-3.5" /> Reinstate</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setDel(u)} aria-label="Delete user"><Trash2 className="h-3.5 w-3.5 text-rose-600" /></Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <p className="text-xs text-slate-500">Suspending a user signs them out, blocks login, and stops all their dynamic QR codes and hosted pages.</p>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete user?" size="sm" footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
        <Button variant="danger" onClick={async () => { try { await api(`/api/admin/users/${del.id}`, { method: "DELETE" }); toast.success("User deleted"); setDel(null); reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }}>Delete</Button></>}>
        <p className="text-sm">Permanently delete <strong>{del?.email}</strong> and all of their QR codes and analytics? Consider suspending instead.</p>
      </Modal>
    </div>
  );
}

function RedirectsTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const dq = useDebounced(q);
  const { items, reload } = useList<any>(`/api/admin/qrcodes?q=${encodeURIComponent(dq)}&status=${status}`);
  const setQrStatus = async (id: string, s: string) => {
    try { await api(`/api/admin/qrcodes/${id}`, { method: "PATCH", json: { status: s } }); toast.success(`Set to ${s}`); reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  return (
    <div className="space-y-4">
      <SearchBar value={q} onChange={setQ}>
        <Select className="w-auto py-2" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter"><option value="">All</option><option value="active">Active</option><option value="paused">Paused</option><option value="disabled">Disabled</option></Select>
      </SearchBar>
      {!items ? <Skeleton className="h-64" /> : (
        <Table head={["Short code", "Name / owner", "Destination", "Scans", "Status", ""]}>
          {items.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2.5 font-mono text-xs"><a className="text-brand hover:underline" href={`/${r.isHosted ? "p" : "r"}/${r.shortCode}`} target="_blank" rel="noopener noreferrer">{r.shortCode}</a></td>
              <td className="px-4 py-2.5"><p className="font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.user.email}{r.user.status !== "active" && " (suspended)"}</p></td>
              <td className="max-w-xs px-4 py-2.5 text-xs text-slate-500">{r.isHosted ? <Badge tone="violet">Hosted {r.type}</Badge> : <span className="break-all">{truncate(r.destination || "", 80)}</span>}</td>
              <td className="px-4 py-2.5 tabular-nums">{formatNumber(r._count.scans)}</td>
              <td className="px-4 py-2.5"><Badge tone={r.status === "active" ? "green" : r.status === "paused" ? "amber" : "rose"}>{r.status}</Badge></td>
              <td className="px-4 py-2.5 text-right">
                {r.status === "disabled"
                  ? <Button size="sm" variant="outline" onClick={() => setQrStatus(r.id, "active")}>Re-enable</Button>
                  : <Button size="sm" variant="outline" onClick={() => setQrStatus(r.id, "disabled")}><Ban className="h-3.5 w-3.5" /> Disable</Button>}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

const REASONS: Record<string, string> = { phishing: "Phishing", scam: "Scam / fraud", malware: "Malware", payment_fraud: "Payment fraud", illegal: "Illegal content", spam: "Spam", other: "Other" };

function ReportsTab() {
  const [status, setStatus] = useState("open");
  const { items, reload } = useList<any>(`/api/admin/reports?status=${status}`);
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast.success(msg); reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } };
  return (
    <div className="space-y-4">
      <Select className="w-auto py-2" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Report status"><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="">All</option></Select>
      {!items ? <Skeleton className="h-64" /> : items.length === 0 ? <Alert tone="success">No {status || ""} reports.</Alert> : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="rose"><AlertOctagon className="h-3 w-3" /> {REASONS[r.reason] || r.reason}</Badge>
                    <span className="font-mono text-xs">{r.shortCode || truncate(r.url, 60)}</span>
                    <span className="text-xs text-slate-500">{formatDate(r.createdAt, true)}</span>
                  </div>
                  {r.details && <p className="mt-2 whitespace-pre-line text-sm">{r.details}</p>}
                  {r.reporterEmail && <p className="mt-1 text-xs text-slate-500">Reporter: {r.reporterEmail}</p>}
                  {r.qr ? (
                    <p className="mt-2 text-xs text-slate-500">QR “{r.qr.name}” by {r.qr.user.email} · status <strong>{r.qr.status}</strong>{!r.qr.isHosted && r.qr.destination && <> · → <span className="break-all">{truncate(r.qr.destination, 80)}</span></>}</p>
                  ) : <p className="mt-2 text-xs text-slate-400">No matching QR code on this site.</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.qr && r.qr.status !== "disabled" && <Button size="sm" variant="danger" onClick={() => act(() => api(`/api/admin/qrcodes/${r.qr.id}`, { method: "PATCH", json: { status: "disabled" } }), "QR disabled")}><Ban className="h-3.5 w-3.5" /> Disable QR</Button>}
                  {r.qr && r.qr.user.status === "active" && <Button size="sm" variant="outline" onClick={() => act(() => api(`/api/admin/users/${r.qr.user.id}`, { method: "PATCH", json: { status: "suspended" } }), "Owner suspended")}>Suspend owner</Button>}
                  {r.status === "open" && <>
                    <Button size="sm" variant="outline" onClick={() => act(() => api(`/api/admin/reports/${r.id}`, { method: "PATCH", json: { status: "resolved" } }), "Marked resolved")}>Resolve</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(() => api(`/api/admin/reports/${r.id}`, { method: "PATCH", json: { status: "dismissed" } }), "Dismissed")}>Dismiss</Button>
                  </>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentsTab() {
  const { items } = useList<any>("/api/admin/payments");
  return (
    <div className="space-y-4">
      <Alert tone="info">Only payments confirmed by a signature-verified Razorpay webhook are marked <strong>paid</strong> and upgrade a plan. “Created” means checkout was started, not that money was received.</Alert>
      {!items ? <Skeleton className="h-48" /> : items.length === 0 ? <p className="text-sm text-slate-500">No payments yet.</p> : (
        <Table head={["When", "User", "Plan", "Amount", "Status", "Provider ref"]}>
          {items.map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs">{formatDate(p.createdAt, true)}</td>
              <td className="px-4 py-2.5">{p.user.email}</td>
              <td className="px-4 py-2.5 capitalize">{p.plan}</td>
              <td className="px-4 py-2.5 tabular-nums">₹{formatNumber(p.amount / 100)}</td>
              <td className="px-4 py-2.5"><Badge tone={p.status === "paid" ? "green" : p.status === "created" ? "slate" : "rose"}>{p.status}</Badge></td>
              <td className="px-4 py-2.5 font-mono text-xs">{p.providerRef}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function LogsTab() {
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const { items, reload } = useList<any>(`/api/admin/logs?level=${level}&q=${encodeURIComponent(dq)}`);
  return (
    <div className="space-y-4">
      <SearchBar value={q} onChange={setQ}>
        <Select className="w-auto py-2" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level"><option value="">All levels</option><option value="error">Errors</option><option value="warn">Warnings</option><option value="info">Info</option></Select>
        <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </SearchBar>
      {!items ? <Skeleton className="h-64" /> : (
        <Table head={["Time", "Level", "Event", "Message"]}>
          {items.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{formatDate(l.createdAt, true)}</td>
              <td className="px-4 py-2"><Badge tone={l.level === "error" ? "rose" : l.level === "warn" ? "amber" : "slate"}>{l.level}</Badge></td>
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{l.event}</td>
              <td className="max-w-xl break-words px-4 py-2 text-xs">{l.message}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function SettingsTab() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/admin/settings").then(setData).catch((e) => toast.error(e.message)); }, []);
  if (!data) return <Skeleton className="h-96" />;
  const s = data.settings;
  const set = (k: string, v: unknown) => setData({ ...data, settings: { ...s, [k]: v } });
  const save = async () => {
    setBusy(true);
    try { await api("/api/admin/settings", { method: "PUT", json: s }); toast.success("Saved — reload to see branding changes everywhere"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  const i = data.integrations;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="space-y-4 p-6">
        <h3 className="font-display text-lg font-bold">Branding & site</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site name"><Input value={s.siteName} maxLength={40} onChange={(e) => set("siteName", e.target.value)} /></Field>
          <Field label="Company / legal name"><Input value={s.companyName} maxLength={100} onChange={(e) => set("companyName", e.target.value)} /></Field>
        </div>
        <Field label="Tagline"><Input value={s.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} /></Field>
        <Field label="Support email"><Input value={s.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} /></Field>
        <div>
          <span className="label">Brand colour</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(BRAND_COLORS).map(([k, v]) => (
              <button key={k} type="button" onClick={() => set("brand", k)} aria-pressed={s.brand === k}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${s.brand === k ? "border-slate-900 ring-2 ring-slate-900/10 dark:border-white" : "border-slate-200 dark:border-slate-700"}`}>
                <span className="h-4 w-4 rounded-full" style={{ background: `hsl(${v.hsl})` }} /> {v.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Announcement banner" hint="Shown at the top of every page. Leave empty to hide."><Textarea rows={2} value={s.announcement} maxLength={200} onChange={(e) => set("announcement", e.target.value)} /></Field>
        <Switch checked={s.allowSignups} onChange={(v) => set("allowSignups", v)} label="Allow new sign-ups" description="Admins listed in ADMIN_EMAILS can always sign up." />
        <Button onClick={save} loading={busy}>Save settings</Button>
      </Card>
      <Card className="h-fit p-6">
        <h3 className="mb-3 font-display text-lg font-bold">Integrations</h3>
        <ul className="space-y-2 text-sm">
          {[["Public URL", i.appUrl || "not set (uses request origin)"], ["Google login", i.google], ["SMTP email", i.smtp], ["Razorpay billing", i.razorpay], ["Demo mode", i.demo]].map(([k, v]) => (
            <li key={k as string} className="flex items-center justify-between gap-2">
              <span>{k}</span>
              {typeof v === "boolean" ? <Badge tone={v ? (k === "Demo mode" ? "amber" : "green") : "slate"}>{v ? "on" : "off"}</Badge> : <span className="truncate font-mono text-xs">{v}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Configured with environment variables — see README and .env.example.</p>
      </Card>
    </div>
  );
}
