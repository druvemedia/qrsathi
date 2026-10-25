"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Archive, ArchiveRestore, CheckCircle2, CircleDashed, Copy, Eye, EyeOff, Pencil, Plus, RefreshCw, Star } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, ConfirmDialog, Disclosure, Field, Input, LoadingSkeleton, Modal, Section, Select, Switch, Textarea } from "@/components/ui";
import { RowMenu, TableView, fmtNum, useAdminApi, useAdminData } from "@/components/admin/data";
import { cn } from "@/lib/utils";
import { ComparisonTable, IntervalSwitch, PricingCards, usePricingInterval } from "@/components/pricing/pricing-cards";
import { FetchError } from "@/lib/fetcher";
import {
  CURRENCIES, DEFAULT_PLANS, EXPORT_FORMATS, annualDiscount, formatMoney, parseMoney, planInputSchema, type Interval, type Plan, type PlanInput, type PlanLimits,
} from "@/lib/plans";


interface AdminPlan extends Plan { users: number; liveSubscriptions: number; sync: { mode: string; ready: boolean; intervals: { interval: Interval; synced: boolean; providerPlanId: string | null }[] } }
interface Resp { plans: AdminPlan[]; payments: { mode: string; enabled: boolean; checkoutReady: boolean } }

const STATUS_TONE = { published: "green", draft: "amber", archived: "slate" } as const;

export function PricingAdmin({ canEdit }: { canEdit: boolean }) {
  const call = useAdminApi();
  const { data, error, loading, reload } = useAdminData<Resp>("/api/admin/plans");
  const [editing, setEditing] = useState<AdminPlan | "new" | null>(null);
  const [pending, setPending] = useState<null | { title: string; message: string; label: string; tone: "danger" | "primary"; run: () => Promise<void> }>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [includeDrafts, setIncludeDrafts] = useState(true);

  const visible = useMemo(() => (data?.plans ?? []).filter((p) => p.status === "published" || (includeDrafts && p.status === "draft")), [data, includeDrafts]);
  const iv = usePricingInterval(visible);

  if (error) return <Alert tone="error" title="Couldn't load plans">{error}</Alert>;
  if (loading || !data) return <LoadingSkeleton rows={6} />;

  const action = async (p: AdminPlan, a: "duplicate" | "publish" | "unpublish" | "archive" | "restore" | "sync", confirm = false) => {
    try {
      const r = await call<{ id?: string; created?: unknown[] }>(`/api/admin/plans/${p.id}`, { method: "POST", json: { action: a, confirm } });
      toast.success({ duplicate: `Duplicated as ${r.id}`, publish: `${p.name} is now on the pricing page`, unpublish: `${p.name} is hidden from the pricing page`, archive: `${p.name} archived`, restore: `${p.name} restored as a draft`, sync: r.created?.length ? `Created ${r.created.length} Razorpay plan(s)` : "Already in sync with Razorpay" }[a]);
      setPending(null);
      reload();
    } catch (e) {
      if (e instanceof FetchError && (e.details as { requiresConfirmation?: boolean })?.requiresConfirmation) {
        setPending({ title: `Archive ${p.name}?`, message: e.message, label: "Archive anyway", tone: "danger", run: () => action(p, a, true) });
        return;
      }
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };
  const move = async (idx: number, dir: -1 | 1) => {
    const ids = data.plans.map((p) => p.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    try { await call("/api/admin/plans/reorder", { method: "POST", json: { ids } }); reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't reorder"); }
  };

  return (
    <div className="space-y-6">
      {!data.payments.checkoutReady && (
        <Alert tone="info" title="Online checkout is off">
          Plans can be prepared and published now; customers can pay once Razorpay is configured, verified and enabled in <Link href="/admin/settings/payments" className="font-medium underline">Payment gateway</Link>, and each paid plan is synced.
        </Alert>
      )}

      <TableView title="Plans" count={`${data.plans.length} · prices in minor units · Razorpay ${data.payments.mode} mode`}
        actions={canEdit && <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" /> New plan</Button>}
        footer={!canEdit && <p className="text-xs text-slate-500">Only super administrators can change plans and prices.</p>}>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800" aria-label="Plans">
          {data.plans.map((p, i) => {
            const free = p.monthlyPrice === 0 && p.annualPrice === 0;
            const disc = annualDiscount(p);
            const unsynced = !free && p.status !== "archived" && p.sync.intervals.some((x) => !x.synced);
            return (
              <li key={p.id} className={cn("flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30 sm:px-5 lg:flex-row lg:items-center", p.status === "archived" && "opacity-60")}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex flex-col">
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={!canEdit || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${p.name} up`}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={!canEdit || i === data.plans.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${p.name} down`}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-lg">{p.name}</span>
                      {p.featured && <Badge tone="amber"><Star className="h-3 w-3 fill-current" /> Featured</Badge>}
                      <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                    </div>
                    <p className="font-mono text-xs text-slate-500">{p.id}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-sm lg:w-[420px]">
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly</dt><dd className="tabular-nums">{free ? "Free" : p.monthlyPrice ? formatMoney(p.monthlyPrice, p.currency) : "—"}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Yearly</dt><dd className="tabular-nums">{p.annualPrice ? <>{formatMoney(p.annualPrice, p.currency)}{disc ? <span className="ml-1 text-xs text-emerald-600">−{disc}%</span> : null}</> : free ? "Free" : "—"}</dd></div>
                  <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customers</dt><dd className="tabular-nums">{fmtNum(p.users)} <span className="text-xs text-slate-500">· {fmtNum(p.liveSubscriptions)} active subs</span></dd></div>
                </dl>
                <div className="flex flex-wrap items-center gap-2 lg:w-[300px] lg:justify-end">
                  {free ? <span className="text-xs text-slate-400">Razorpay not needed</span>
                    : p.sync.intervals.map((x) => <Badge key={x.interval} tone={x.synced ? "green" : "amber"}>{x.synced ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}{x.interval === "month" ? "Monthly" : "Yearly"} {x.synced ? "synced" : "pending"}</Badge>)}
                  {canEdit && <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
                  {canEdit && (
                    <RowMenu label={`More actions for ${p.name}`} items={[
                      { label: "Sync with Razorpay", icon: RefreshCw, hidden: !unsynced || !p.sync.ready, onClick: () => setPending({ title: `Sync ${p.name} with Razorpay?`, message: `Creates Razorpay plans for the current ${data.payments.mode}-mode prices. Existing subscriptions stay on their current Razorpay plan.`, label: "Create Razorpay plans", tone: "primary", run: () => action(p, "sync") }) },
                      { label: "Duplicate", icon: Copy, onClick: () => action(p, "duplicate") },
                      { label: "Publish", icon: Eye, hidden: p.status !== "draft", onClick: () => setPending({ title: `Publish ${p.name}?`, message: "It appears on the public pricing page immediately.", label: "Publish", tone: "primary", run: () => action(p, "publish") }) },
                      { label: "Unpublish", icon: EyeOff, hidden: !(p.status === "published" && p.id !== "free"), onClick: () => setPending({ title: `Hide ${p.name} from the pricing page?`, message: "New customers can't choose it. Existing subscribers aren't affected.", label: "Unpublish", tone: "primary", run: () => action(p, "unpublish") }) },
                      { label: "Restore as draft", icon: ArchiveRestore, hidden: p.status !== "archived", onClick: () => action(p, "restore") },
                      { label: "Archive", icon: Archive, danger: true, hidden: !(p.status !== "archived" && p.id !== "free"), onClick: () => setPending({ title: `Archive ${p.name}?`, message: "It's removed from the pricing page and from checkout. Existing subscribers keep their entitlements until their subscription ends.", label: "Archive", tone: "danger", run: () => action(p, "archive") }) },
                    ]} />
                  )}
                </div>
                {unsynced && !p.sync.ready && canEdit && <p className="text-xs text-amber-700 dark:text-amber-400">Configure and verify Razorpay before syncing.</p>}
              </li>
            );
          })}
        </ul>
      </TableView>

      <Section title="Preview" description="The public pricing page renders exactly these components."
        actions={<div className="flex flex-wrap items-center gap-3"><Switch checked={includeDrafts} onChange={setIncludeDrafts} label="Include drafts" /><Button size="sm" variant="ghost" onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Hide" : "Show"}</Button></div>}>
        {showPreview && (visible.length ? (
          <div className="space-y-8">
            {iv.both && <IntervalSwitch interval={iv.interval} setInterval={iv.setInterval} maxSave={iv.maxSave} />}
            <PricingCards plans={visible} interval={iv.interval} preview />
            <ComparisonTable plans={visible} />
          </div>
        ) : <p className="text-sm text-slate-500">No published plans: the pricing page shows a short notice instead of prices.</p>)}
      </Section>

      {editing && <PlanEditor plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} existingIds={data.plans.map((p) => p.id)} />}
      <ConfirmDialog open={!!pending} onClose={() => setPending(null)} title={pending?.title ?? ""} confirmLabel={pending?.label} tone={pending?.tone ?? "primary"} onConfirm={async () => { await pending?.run(); }}>
        {pending?.message}
      </ConfirmDialog>
    </div>
  );
}

const LIMIT_FIELDS: { key: keyof PlanLimits; label: string; hint?: string }[] = [
  { key: "savedQr", label: "Saved QR codes" }, { key: "dynamic", label: "Dynamic QR codes" }, { key: "hosted", label: "Hosted pages" },
  { key: "products", label: "Products" }, { key: "barcodes", label: "Stored product barcodes" }, { key: "bulkRows", label: "Rows per bulk batch / import" },
  { key: "uploadMb", label: "Largest upload (MB)" }, { key: "storageMb", label: "Total file storage (MB)" }, { key: "analyticsDays", label: "Analytics history (days)", hint: "0 = analytics not included" },
];
const BOOL_FIELDS: { key: "analyticsExport" | "customAlias" | "expiry" | "prioritySupport"; label: string }[] = [
  { key: "analyticsExport", label: "Analytics CSV export" }, { key: "customAlias", label: "Custom short-link aliases" }, { key: "expiry", label: "QR expiry dates" }, { key: "prioritySupport", label: "Priority support" },
];
const money = (m: number) => (m ? (m / 100).toFixed(2).replace(/\.00$/, "") : "");

function PlanEditor({ plan, onClose, onSaved, existingIds }: { plan: AdminPlan | null; onClose: () => void; onSaved: () => void; existingIds: string[] }) {
  const call = useAdminApi();
  const base: Plan = plan ?? { ...DEFAULT_PLANS[1], id: "", name: "", featured: false, sortOrder: existingIds.length, status: "draft" };
  const [f, setF] = useState({ ...base, features: base.features.join("\n"), monthly: money(base.monthlyPrice), annual: money(base.annualPrice) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [discount, setDiscount] = useState("");
  const isFree = f.id === "free";
  const setL = <K extends keyof PlanLimits>(k: K, v: PlanLimits[K]) => setF({ ...f, limits: { ...f.limits, [k]: v } });

  const build = (): PlanInput | null => {
    const monthly = f.monthly.trim() ? parseMoney(f.monthly) : 0;
    const annual = f.annual.trim() ? parseMoney(f.annual) : 0;
    const e: Record<string, string> = {};
    if (monthly === null) e.monthlyPrice = "Enter an amount like 299 or 299.50";
    if (annual === null) e.annualPrice = "Enter an amount like 2990 or 2990.50";
    const input = { id: f.id.trim(), name: f.name, description: f.description, currency: f.currency, monthlyPrice: monthly ?? 0, annualPrice: annual ?? 0,
      features: f.features.split("\n").map((s) => s.trim()).filter(Boolean), limits: f.limits, featured: f.featured, sortOrder: f.sortOrder };
    const r = planInputSchema.safeParse(input);
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ||= i.message;
    if (!plan && existingIds.includes(input.id)) e.id = "That identifier is already used.";
    setErrors(e);
    return Object.keys(e).length ? null : (r.success ? r.data : null);
  };
  const save = async (confirmed = false) => {
    const input = build();
    if (!input) { toast.error("Fix the highlighted fields."); return; }
    setBusy(true);
    try {
      const r = plan
        ? await call<{ providerSyncRequired?: boolean; liveSubscriptionsKeptOnOldPrice?: number }>(`/api/admin/plans/${plan.id}`, { method: "PATCH", json: { plan: input, confirm: confirmed } })
        : await call("/api/admin/plans", { method: "POST", json: input });
      toast.success(plan ? "Plan saved" : "Plan created as a draft", { description: (r as { providerSyncRequired?: boolean }).providerSyncRequired ? "Prices changed: sync with Razorpay so new subscribers are charged the new price. Existing subscriptions keep their price." : undefined });
      onSaved();
    } catch (e) {
      if (e instanceof FetchError && (e.details as { requiresConfirmation?: boolean })?.requiresConfirmation) { setConfirm(e.message); return; }
      const m = e instanceof FetchError ? /^(\w+)[.\w]*: (.+)$/.exec(e.message) : null;
      if (m) setErrors({ [m[1]]: m[2] });
      toast.error(e instanceof Error ? e.message : "Couldn't save the plan");
    } finally {
      setBusy(false);
    }
  };
  const applyDiscount = () => {
    const pct = Number(discount);
    const m = parseMoney(f.monthly);
    if (!m || !Number.isInteger(pct) || pct < 0 || pct > 90) { toast.error("Enter a monthly price and a whole-number discount between 0 and 90."); return; }
    // Integer arithmetic on minor units.
    setF({ ...f, annual: money(Math.round((m * 12 * (100 - pct)) / 100)) });
  };

  return (
    <Modal open onClose={onClose} size="lg" title={plan ? `Edit ${plan.name}` : "New plan"} description={plan ? `Identifier: ${plan.id}` : "New plans start as drafts and aren't visible until published."}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => save()} loading={busy}>{plan ? "Save plan" : "Create plan"}</Button></>}>
      <div className="space-y-7 [&>section>h3]:mb-3 [&>section>h3]:text-[11px] [&>section>h3]:font-semibold [&>section>h3]:uppercase [&>section>h3]:tracking-wider [&>section>h3]:text-slate-500">
        {plan && plan.liveSubscriptions > 0 && <Alert tone="warn">{plan.liveSubscriptions} customer{plan.liveSubscriptions === 1 ? " has" : "s have"} an active subscription. Price changes apply to new subscribers only; entitlement (limit) changes apply to everyone on this plan immediately.</Alert>}
        <section><h3>Identity</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Identifier" htmlFor="pl-id" error={errors.id} hint="Lowercase, used internally and in subscriptions. Can't be changed later.">
            <Input id="pl-id" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value.toLowerCase() })} disabled={!!plan} className="font-mono" />
          </Field>
          <Field label="Display name" htmlFor="pl-name" error={errors.name}><Input id="pl-name" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Short description" htmlFor="pl-desc" error={errors.description} className="sm:col-span-2"><Input id="pl-desc" value={f.description} maxLength={200} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        </section>

        <section><h3>Pricing</h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Currency" htmlFor="pl-cur"><Select id="pl-cur" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Plan["currency"] })} disabled={isFree}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Monthly price" htmlFor="pl-m" error={errors.monthlyPrice} hint="Empty = not offered monthly"><Input id="pl-m" inputMode="decimal" value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} disabled={isFree} placeholder="299" /></Field>
          <Field label="Yearly price" htmlFor="pl-y" error={errors.annualPrice} hint={annualDiscount({ monthlyPrice: parseMoney(f.monthly) ?? 0, annualPrice: parseMoney(f.annual) ?? 0 }) ? `${annualDiscount({ monthlyPrice: parseMoney(f.monthly) ?? 0, annualPrice: parseMoney(f.annual) ?? 0 })}% less than 12 × monthly` : "Empty = not offered yearly"}>
            <Input id="pl-y" inputMode="decimal" value={f.annual} onChange={(e) => setF({ ...f, annual: e.target.value })} disabled={isFree} placeholder="2990" />
          </Field>
        </div>
        {!isFree && (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Yearly discount helper" htmlFor="pl-disc"><Input id="pl-disc" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))} className="w-24" placeholder="17" /></Field>
            <Button variant="outline" onClick={applyDiscount}>Set yearly price from % off</Button>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Free trials aren&apos;t implemented, so none are offered or advertised.</p>
        </section>

        <section>
          <h3>Entitlements · enforced by the server</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {LIMIT_FIELDS.map((l) => (
              <Field key={l.key} label={l.label} htmlFor={`pl-${l.key}`} hint={l.hint}>
                <Input id={`pl-${l.key}`} type="number" min={l.key === "uploadMb" || l.key === "storageMb" ? 1 : 0} value={String(f.limits[l.key])} onChange={(e) => setL(l.key, Math.max(0, Math.floor(Number(e.target.value) || 0)) as never)} />
              </Field>
            ))}
          </div>
          {errors.limits && <p className="err">{errors.limits}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {BOOL_FIELDS.map((b) => <Switch key={b.key} checked={f.limits[b.key]} onChange={(v) => setL(b.key, v)} label={b.label} />)}
          </div>
          <fieldset className="mt-4">
            <legend className="label">Export formats</legend>
            <div className="flex flex-wrap gap-3">
              {EXPORT_FORMATS.map((x) => (
                <label key={x} className="inline-flex items-center gap-1.5 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded accent-[hsl(var(--brand))]" checked={f.limits.exports.includes(x)}
                    onChange={(e) => setL("exports", e.target.checked ? [...f.limits.exports, x] : f.limits.exports.filter((y) => y !== x))} /> {x.toUpperCase()}
                </label>
              ))}
            </div>
            <p className="hint">Shown on the plan; server-side downloads respect it. Static images rendered in the browser can&apos;t be technically restricted.</p>
          </fieldset>
        </section>

        <section><h3>Pricing card</h3>

        <Field label="Features shown on the pricing card" htmlFor="pl-feat" error={errors.features} hint="One per line, up to 20. Only list what the plan actually includes.">
          <Textarea id="pl-feat" rows={6} value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} />
        </Field>
        <div className="mt-4"><Switch checked={f.featured} onChange={(v) => setF({ ...f, featured: v })} label="Feature this plan" description="Highlighted as “Recommended” on the pricing page. Only one plan can be featured." /></div>
        </section>
        <Disclosure title="Card preview" description="How this card looks with the values above (not saved yet)">
          <div className="mx-auto max-w-sm">
            <PricingCards preview interval={parseMoney(f.monthly) ? "month" : "year"} plans={[{
              ...base, name: f.name || "Untitled plan", description: f.description, currency: f.currency, featured: f.featured, limits: f.limits, status: plan?.status ?? "draft",
              monthlyPrice: parseMoney(f.monthly) ?? 0, annualPrice: parseMoney(f.annual) ?? 0, features: f.features.split("\n").map((x) => x.trim()).filter(Boolean),
            }]} />
          </div>
        </Disclosure>
      </div>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title="Change the price of a plan with subscribers?" confirmLabel="Save new price" tone="danger" onConfirm={async () => { setConfirm(null); await save(true); }}>
        {confirm}
      </ConfirmDialog>
    </Modal>
  );
}

