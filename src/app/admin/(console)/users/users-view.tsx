"use client";
import { useState } from "react";
import { Ban, CheckCircle2, KeyRound, LogOut, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, ConfirmDialog, Field, FilterBar, Input, Modal, SearchInput, Section, Select } from "@/components/ui";
import { DataTable, Pagination, fmtDate, fmtDateTime, fmtNum, useAdminApi, useAdminData, useListQuery, type Column, type Paged } from "@/components/admin/data";
import { ROLE_LABELS } from "@/lib/roles";

interface Row {
  id: string; email: string; name: string; role: string; plan: string; planExpiresAt: string | null; status: string;
  createdAt: string; lastLoginAt: string | null; google: boolean; hasPassword: boolean; mfaEnabled: boolean;
  _count: { qrCodes: number; products: number; sessions: number };
}
type Actor = { id: string; role: string };
type BulkAction = "suspend" | "reactivate" | "revoke_sessions";

const BULK_LABEL: Record<BulkAction, string> = { suspend: "Suspend", reactivate: "Reactivate", revoke_sessions: "Sign out everywhere" };

export function UsersView({ actor }: { actor: Actor }) {
  const call = useAdminApi();
  const list = useListQuery("/api/admin/users");
  const { data, loading, error, reload } = useAdminData<Paged<Row>>(list.url);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BulkAction | null>(null);
  const [open, setOpen] = useState<Row | null>(null);

  const runBulk = async () => {
    if (!bulk) return;
    try {
      const r = await call<{ done: number; failed: number; results: { ok: boolean; error?: string }[] }>("/api/admin/users/bulk", { method: "POST", json: { ids: [...selected], action: bulk } });
      if (r.failed) toast.warning(`${r.done} updated, ${r.failed} skipped`, { description: r.results.find((x) => !x.ok)?.error });
      else toast.success(`${r.done} account${r.done === 1 ? "" : "s"} updated`);
      setSelected(new Set());
      setBulk(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk action failed");
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "email", label: "User", sortable: true, render: (u) => (
        <div className="min-w-0 max-w-[260px]">
          <p className="truncate font-medium">{u.name || "—"}</p>
          <p className="truncate text-xs text-slate-500">{u.email}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {u.google && <Badge tone="blue">Google</Badge>}
            {!u.hasPassword && <Badge>No password</Badge>}
            {u.mfaEnabled && <Badge tone="green">2FA</Badge>}
          </div>
        </div>
      ),
    },
    { key: "role", label: "Role", sortable: true, render: (u) => <Badge tone={u.role === "user" ? "slate" : "amber"}>{ROLE_LABELS[u.role] || u.role}</Badge> },
    { key: "plan", label: "Plan", sortable: true, render: (u) => <span className="capitalize">{u.plan}</span> },
    { key: "status", label: "Status", sortable: true, render: (u) => <Badge tone={u.status === "active" ? "green" : "rose"}>{u.status}</Badge> },
    { key: "usage", label: "Usage", hideSm: true, render: (u) => <span className="whitespace-nowrap text-xs text-slate-500">{fmtNum(u._count.qrCodes)} QR · {fmtNum(u._count.products)} products</span> },
    { key: "createdAt", label: "Joined", sortable: true, hideSm: true, render: (u) => <span className="whitespace-nowrap text-xs">{fmtDate(u.createdAt)}</span> },
    { key: "lastLoginAt", label: "Last sign-in", sortable: true, hideSm: true, render: (u) => <span className="whitespace-nowrap text-xs">{fmtDateTime(u.lastLoginAt)}</span> },
    { key: "actions", label: <span className="sr-only">Actions</span>, className: "text-right", render: (u) => <Button size="icon" variant="ghost" onClick={() => setOpen(u)} aria-label={`Manage ${u.email}`}><MoreHorizontal className="h-4 w-4" /></Button> },
  ];

  return (
    <Section title="All accounts" description={data ? `${fmtNum(data.total)} matching` : undefined}>
      <FilterBar
        actions={selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => setBulk("suspend")}><Ban className="h-3.5 w-3.5" /> Suspend</Button>
            <Button size="sm" variant="outline" onClick={() => setBulk("reactivate")}><CheckCircle2 className="h-3.5 w-3.5" /> Reactivate</Button>
            <Button size="sm" variant="outline" onClick={() => setBulk("revoke_sessions")}><LogOut className="h-3.5 w-3.5" /> Sign out</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}>
        <SearchInput value={list.state.q} onChange={list.setQ} placeholder="Search email or name" aria-label="Search users" className="w-full sm:w-64" />
        <Select aria-label="Filter by status" value={list.state.filters.status || ""} onChange={(e) => list.setFilter("status", e.target.value)} className="w-auto">
          <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </Select>
        <Select aria-label="Filter by role" value={list.state.filters.role || ""} onChange={(e) => list.setFilter("role", e.target.value)} className="w-auto">
          <option value="">All roles</option><option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super admin</option>
        </Select>
        <Select aria-label="Filter by plan" value={list.state.filters.plan || ""} onChange={(e) => list.setFilter("plan", e.target.value)} className="w-auto">
          <option value="">All plans</option><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option>
        </Select>
      </FilterBar>

      <div className="mt-4">
        <DataTable caption="Users" columns={columns} data={data?.items} loading={loading} error={error} onRetry={reload}
          sort={list.state.sort} order={list.state.order} onSort={list.toggleSort}
          selectable selected={selected} onSelect={setSelected}
          empty={{ title: "No users match", body: "Try a different search or clear the filters." }} />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} onPage={list.setPage} onPageSize={list.setPageSize} />}
      </div>

      <ConfirmDialog open={!!bulk} onClose={() => setBulk(null)} onConfirm={runBulk} tone={bulk === "reactivate" ? "primary" : "danger"}
        title={`${bulk ? BULK_LABEL[bulk] : ""}: ${selected.size} account${selected.size === 1 ? "" : "s"}?`} confirmLabel={bulk ? BULK_LABEL[bulk] : "Confirm"}>
        {bulk === "suspend" && "Suspended users are signed out immediately and can't sign in until reactivated. Their data is kept."}
        {bulk === "reactivate" && "These accounts will be able to sign in again."}
        {bulk === "revoke_sessions" && "Every browser signed in to these accounts will be signed out."}
        <p className="mt-2 text-xs text-slate-500">Your own account and accounts you aren&apos;t permitted to manage are skipped. Every change is recorded in the audit log.</p>
      </ConfirmDialog>

      {open && <UserDialog row={open} actor={actor} onClose={() => setOpen(null)} onChanged={() => { reload(); }} />}
    </Section>
  );
}

function UserDialog({ row, actor, onClose, onChanged }: { row: Row; actor: Actor; onClose: () => void; onChanged: () => void }) {
  const call = useAdminApi();
  const [u, setU] = useState(row);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState<null | "suspend" | "reactivate" | "revoke" | "delete" | "role">(null);
  const [plan, setPlan] = useState(row.plan);
  const [role, setRole] = useState(row.role);
  const [typed, setTyped] = useState("");
  const self = u.id === actor.id;
  const isSuper = actor.role === "super_admin";
  const targetIsAdmin = u.role !== "user";
  const canManage = !self && (isSuper || !targetIsAdmin);

  const run = async (key: string, fn: () => Promise<any>, success?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      toast.success(r?.message || success || "Saved");
      onChanged();
      return r;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy("");
      setConfirm(null);
    }
  };
  const patch = (body: Record<string, string>, success: string) =>
    run(Object.keys(body)[0], async () => {
      const r = await call(`/api/admin/users/${u.id}`, { method: "PATCH", json: body });
      setU((x) => ({ ...x, ...r.user }));
      return r;
    }, success);

  return (
    <Modal open onClose={onClose} size="lg" title={u.name || u.email} description={u.email}>
      <div className="space-y-5">
        {self && <Alert tone="info">This is your own account. Status, role and deletion can&apos;t be changed from here.</Alert>}
        {!self && !canManage && <Alert tone="warn">Only a super administrator can manage administrator accounts.</Alert>}

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Role", ROLE_LABELS[u.role] || u.role], ["Status", u.status], ["Plan", u.plan + (u.planExpiresAt ? ` (until ${fmtDate(u.planExpiresAt)})` : "")],
            ["Sign-in", [u.hasPassword && "Password", u.google && "Google", u.mfaEnabled && "2FA"].filter(Boolean).join(" · ") || "—"],
            ["Joined", fmtDate(u.createdAt)], ["Last sign-in", fmtDateTime(u.lastLoginAt)],
            ["QR codes", fmtNum(u._count.qrCodes)], ["Products", fmtNum(u._count.products)],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0"><dt className="text-xs text-slate-500">{k}</dt><dd className="truncate font-medium capitalize">{v}</dd></div>
          ))}
        </dl>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan" htmlFor="u-plan" hint="Admin-assigned plans don't expire.">
            <div className="flex gap-2">
              <Select id="u-plan" value={plan} onChange={(e) => setPlan(e.target.value)} disabled={!isSuper && targetIsAdmin}>
                <option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option>
              </Select>
              <Button variant="outline" disabled={plan === u.plan} loading={busy === "plan"} onClick={() => patch({ plan }, "Plan updated")}>Save</Button>
            </div>
          </Field>
          {isSuper && (
            <Field label="Role" htmlFor="u-role" hint="Changing a role signs the user out everywhere.">
              <div className="flex gap-2">
                <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={self}>
                  <option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super admin</option>
                </Select>
                <Button variant="outline" disabled={self || role === u.role} onClick={() => setConfirm("role")}>Save</Button>
              </div>
            </Field>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Account actions</p>
          <div className="flex flex-wrap gap-2">
            {u.status === "active"
              ? <Button variant="outline" disabled={!canManage} onClick={() => setConfirm("suspend")}><Ban className="h-4 w-4" /> Suspend</Button>
              : <Button variant="outline" disabled={!canManage} onClick={() => setConfirm("reactivate")}><CheckCircle2 className="h-4 w-4" /> Reactivate</Button>}
            <Button variant="outline" disabled={!canManage} onClick={() => setConfirm("revoke")}><LogOut className="h-4 w-4" /> Sign out everywhere</Button>
            <Button variant="outline" disabled={!canManage || u.status !== "active"} loading={busy === "reset"}
              onClick={() => run("reset", () => call(`/api/admin/users/${u.id}`, { method: "POST", json: { action: "send_password_reset" } }))}>
              <KeyRound className="h-4 w-4" /> Send password-reset link
            </Button>
            {isSuper && <Button variant="danger" disabled={self} onClick={() => setConfirm("delete")}><Trash2 className="h-4 w-4" /> Delete account</Button>}
          </div>
          <p className="mt-2 text-xs text-slate-500">Administrators never see or set passwords. Reset links go to the account&apos;s own e-mail address.</p>
        </div>
      </div>

      <ConfirmDialog open={confirm === "suspend"} onClose={() => setConfirm(null)} title="Suspend this account?" confirmLabel="Suspend"
        onConfirm={() => patch({ status: "suspended" }, "Account suspended")}>
        {u.email} will be signed out immediately and blocked from signing in. Their QR codes and data are kept; dynamic codes keep redirecting unless you disable them.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "reactivate"} onClose={() => setConfirm(null)} title="Reactivate this account?" confirmLabel="Reactivate" tone="primary"
        onConfirm={() => patch({ status: "active" }, "Account reactivated")}>
        {u.email} will be able to sign in again.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "revoke"} onClose={() => setConfirm(null)} title="Sign out everywhere?" confirmLabel="Sign out"
        onConfirm={() => run("revoke", () => call(`/api/admin/users/${u.id}`, { method: "POST", json: { action: "revoke_sessions" } }))}>
        Every browser and device signed in as {u.email} will be signed out.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "role"} onClose={() => setConfirm(null)} title={`Change role to ${ROLE_LABELS[role]}?`} confirmLabel="Change role"
        onConfirm={() => patch({ role }, "Role updated")}>
        {role === "user" ? "Administrator access is removed and their two-factor setup is cleared." : "This grants access to the admin console. Make sure this person should have it."} The user is signed out everywhere.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "delete"} onClose={() => { setConfirm(null); setTyped(""); }} title="Permanently delete this account?" confirmLabel="Delete forever"
        onConfirm={async () => {
          if (typed.trim().toLowerCase() !== u.email.toLowerCase()) { toast.error("Type the e-mail address exactly to confirm."); return; }
          const r = await run("delete", () => call(`/api/admin/users/${u.id}`, { method: "DELETE" }), "Account deleted");
          if (r) onClose();
        }}>
        <p>All QR codes, scans, products, inventory history and uploads for this account are deleted. This can&apos;t be undone.</p>
        <Field label={<>Type <strong>{u.email}</strong> to confirm</>} htmlFor="del-typed" className="mt-3">
          <Input id="del-typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      </ConfirmDialog>
    </Modal>
  );
}
