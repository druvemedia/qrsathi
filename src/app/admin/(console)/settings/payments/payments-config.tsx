"use client";
import { useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, Eye, EyeOff, KeyRound, Lock, PlugZap, ServerCog, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, LoadingSkeleton, Section, Switch, Tabs } from "@/components/ui";
import { fmtDateTime, useAdminApi, useAdminData } from "@/components/admin/data";
import { useReauth, useUnsavedGuard } from "@/components/admin/guards";
import { FetchError } from "@/lib/fetcher";

type Mode = "test" | "live";
type Status = "missing" | "incomplete" | "unverified" | "verified" | "invalid" | "unable";
interface ModeView {
  mode: Mode; source: "environment" | "database" | "none"; keyId: string; keySecretConfigured: boolean; webhookSecretConfigured: boolean;
  status: Status; verifiedAt: string | null; lastCheck: { status: string; message: string; at: string } | null; lastWebhookAt: string | null; updatedAt: string | null;
}
interface Resp { enabled: boolean; mode: Mode; checkoutReady: boolean; storageAvailable: boolean; test: ModeView; live: ModeView }

const STATUS: Record<Status, { label: string; tone: "green" | "amber" | "rose" | "slate"; icon: typeof CheckCircle2 }> = {
  missing: { label: "Missing", tone: "slate", icon: CircleDashed },
  incomplete: { label: "Incomplete", tone: "amber", icon: CircleAlert },
  unverified: { label: "Not verified", tone: "amber", icon: CircleAlert },
  verified: { label: "Verified", tone: "green", icon: CheckCircle2 },
  invalid: { label: "Invalid", tone: "rose", icon: XCircle },
  unable: { label: "Unable to verify", tone: "amber", icon: CircleAlert },
};

export function PaymentsConfig({ canEdit }: { canEdit: boolean }) {
  const call = useAdminApi();
  const { run, dialog: reauthDialog } = useReauth();
  const { data, error, loading, reload } = useAdminData<Resp>("/api/admin/payments/config");
  const [tab, setTab] = useState<Mode>("test");
  const [toggle, setToggle] = useState<null | { enabled: boolean; mode: Mode }>(null);

  if (error) return <Alert tone="error" title="Couldn't load payment settings">{error}</Alert>;
  if (loading || !data) return <LoadingSkeleton rows={6} />;

  const applyToggle = async () => {
    if (!toggle) return;
    try {
      await run(() => call("/api/admin/payments/config", { method: "PATCH", json: toggle }));
      toast.success(toggle.enabled ? `Checkout enabled in ${toggle.mode} mode` : "Checkout disabled");
      setToggle(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update checkout");
    }
  };
  const active = data[data.mode];

  return (
    <div className="max-w-4xl space-y-6">
      <Section title="Razorpay checkout" description="Customers can subscribe online only when checkout is enabled and the active mode's credentials are verified.">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={data.mode === "live" ? "rose" : "blue"}>{data.mode === "live" ? "Live mode" : "Test mode"}</Badge>
          {data.checkoutReady ? <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Accepting payments</Badge> : <Badge tone="slate">Checkout off</Badge>}
          <span className="text-xs text-slate-500">Active credentials: {STATUS[active.status].label.toLowerCase()}</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Switch checked={data.enabled} disabled={!canEdit} onChange={(v) => setToggle({ enabled: v, mode: data.mode })}
            label="Enable online checkout" description="Requires complete, verified credentials for the active mode." />
          <div>
            <span className="label">Active mode</span>
            <div className="flex gap-2">
              {(["test", "live"] as const).map((m) => (
                <Button key={m} size="sm" variant={data.mode === m ? "primary" : "outline"} disabled={!canEdit || data.mode === m}
                  onClick={() => setToggle({ enabled: data.enabled && data[m].status === "verified", mode: m })}>{m === "test" ? "Test" : "Live"}</Button>
              ))}
            </div>
            <p className="hint">Test mode uses Razorpay test keys: no real money moves.</p>
          </div>
        </div>
      </Section>

      {!data.storageAvailable && (
        <Alert tone="info" icon={<ServerCog className="h-4 w-4" />} title="Credentials are managed on the server">
          <code>SETTINGS_ENCRYPTION_KEY</code> isn&apos;t configured, so secrets can&apos;t be stored in the database. Set <code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code> and <code>RAZORPAY_WEBHOOK_SECRET</code> as environment variables (recommended for production), or set a 32+ character <code>SETTINGS_ENCRYPTION_KEY</code> to enter them here.
        </Alert>
      )}

      <Tabs value={tab} onChange={setTab} tabs={(["test", "live"] as const).map((m) => ({ value: m, label: <span className="inline-flex items-center gap-2">{m === "test" ? "Test credentials" : "Live credentials"} <Badge tone={STATUS[data[m].status].tone}>{STATUS[data[m].status].label}</Badge></span> }))} />
      <ModeCredentials key={tab} view={data[tab]} storageAvailable={data.storageAvailable} canEdit={canEdit} run={run} onSaved={reload} />

      <Section title="Setting up Razorpay">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>In the Razorpay Dashboard choose <strong>Test</strong> or <strong>Live</strong> mode, then <em>Account &amp; Settings → API keys</em> → generate a key. Copy the Key ID and Key Secret (the secret is shown once).</li>
          <li>Under <em>Webhooks</em>, add <code className="break-all">{(process.env.NEXT_PUBLIC_APP_URL || "https://your-domain")}/api/billing/webhook</code> with a secret of your choice. Select the events <code>subscription.*</code>, <code>payment.failed</code> and <code>refund.processed</code>.</li>
          <li>Enter the three values here (or as environment variables), then press <strong>Test connection</strong>. The test only lists plans; it creates nothing and charges nothing.</li>
          <li>Go to <em>Plans &amp; pricing</em> and <strong>Sync with Razorpay</strong> for each paid plan, then enable checkout.</li>
          <li>Do a complete test purchase in test mode before switching to live.</li>
        </ol>
      </Section>

      <ConfirmDialog open={!!toggle} onClose={() => setToggle(null)} tone={toggle?.mode === "live" && toggle.enabled ? "danger" : "primary"}
        title={toggle?.enabled ? `Enable checkout in ${toggle.mode} mode?` : toggle && toggle.mode !== data.mode ? `Switch to ${toggle.mode} mode?` : "Disable checkout?"}
        confirmLabel="Confirm" onConfirm={applyToggle}>
        {toggle?.enabled && toggle.mode === "live" ? "Customers will be charged real money." : toggle?.enabled ? "Customers can pay with Razorpay test cards; no real money moves." : "Customers won't be able to start new subscriptions. Existing subscriptions keep renewing at Razorpay."}
      </ConfirmDialog>
      {reauthDialog}
    </div>
  );
}

function SecretInput({ id, value, onChange, placeholder, disabled }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        autoComplete="new-password" spellCheck={false} className="pr-10 font-mono" />
      <button type="button" onClick={() => setShow((s) => !s)} disabled={disabled} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-40 dark:hover:text-slate-200"
        aria-label={show ? "Hide value" : "Show value"} aria-pressed={show}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ModeCredentials({ view, storageAvailable, canEdit, run, onSaved }: { view: ModeView; storageAvailable: boolean; canEdit: boolean; run: <T>(fn: () => Promise<T>) => Promise<T>; onSaved: () => void }) {
  const call = useAdminApi();
  const envManaged = view.source === "environment";
  const editable = canEdit && storageAvailable && !envManaged;
  const [keyId, setKeyId] = useState(view.keyId);
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"" | "save" | "verify">("");
  const [clearField, setClearField] = useState<null | "keySecret" | "webhookSecret">(null);
  const [lastResult, setLastResult] = useState<{ message: string; webhookNote?: string; status: string } | null>(null);
  const dirty = keyId !== view.keyId || !!keySecret || !!webhookSecret;
  const guard = useUnsavedGuard(dirty);
  const S = STATUS[view.status];

  const save = async (clear?: ("keySecret" | "webhookSecret")[]) => {
    setBusy("save");
    setErrors({});
    try {
      const json = { mode: view.mode, ...(keyId !== view.keyId && keyId ? { keyId } : {}), ...(keySecret ? { keySecret } : {}), ...(webhookSecret ? { webhookSecret } : {}), ...(clear ? { clear } : {}) };
      await run(() => call("/api/admin/payments/config", { method: "PUT", json }));
      // Never keep secrets in client state after saving.
      setKeySecret("");
      setWebhookSecret("");
      setClearField(null);
      toast.success(clear ? "Secret removed" : "Credentials saved", { description: "Run “Test connection” to verify them." });
      onSaved();
    } catch (e) {
      const m = e instanceof FetchError ? /^(\w+): (.+)$/.exec(e.message) : null;
      if (m) setErrors({ [m[1]]: m[2] });
      else toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy("");
    }
  };
  const verify = async () => {
    setBusy("verify");
    try {
      const r = await call<{ status: string; message: string; webhookNote?: string }>("/api/admin/payments/config", { method: "POST", json: { action: "verify", mode: view.mode } });
      setLastResult(r);
      (r.status === "verified" ? toast.success : toast.error)(r.message);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <Section title={`${view.mode === "test" ? "Test" : "Live"} credentials`}
      description={envManaged ? "Set by environment variables on the server — change them there." : view.source === "database" ? "Stored encrypted in the database." : "Not configured yet."}
      actions={<Badge tone={S.tone}><S.icon className="h-3 w-3" /> {S.label}</Badge>}>
      <div className="space-y-4">
        {envManaged && <Alert tone="info" icon={<Lock className="h-4 w-4" />}>Environment variables take precedence over values entered here.</Alert>}
        <Field label="Key ID" htmlFor={`${view.mode}-keyId`} error={errors.keyId} hint={`Starts with rzp_${view.mode}_. Not secret (it's sent to Razorpay Checkout in the browser).`}>
          <Input id={`${view.mode}-keyId`} value={keyId} onChange={(e) => setKeyId(e.target.value.trim())} disabled={!editable} placeholder={`rzp_${view.mode}_…`} className="font-mono" spellCheck={false} autoComplete="off" />
        </Field>
        <Field label="Key Secret" htmlFor={`${view.mode}-keySecret`} error={errors.keySecret}
          hint={view.keySecretConfigured ? `Configured${view.updatedAt ? ` · updated ${fmtDateTime(view.updatedAt)}` : ""}. Leave empty to keep it; type a new value to replace it.` : "Not set."}>
          <SecretInput id={`${view.mode}-keySecret`} value={keySecret} onChange={setKeySecret} disabled={!editable} placeholder={view.keySecretConfigured ? "•••••••• (configured — enter a new value to replace)" : "Paste the Key Secret"} />
        </Field>
        <Field label="Webhook Secret" htmlFor={`${view.mode}-webhookSecret`} error={errors.webhookSecret}
          hint={view.webhookSecretConfigured ? `Configured.${view.lastWebhookAt ? ` Last signed webhook received ${fmtDateTime(view.lastWebhookAt)}.` : " No signed webhook received yet."}` : "Not set — payments can't be confirmed without it."}>
          <SecretInput id={`${view.mode}-webhookSecret`} value={webhookSecret} onChange={setWebhookSecret} disabled={!editable} placeholder={view.webhookSecretConfigured ? "•••••••• (configured — enter a new value to replace)" : "The secret you set on the Razorpay webhook"} />
        </Field>

        {view.lastCheck && (
          <Alert tone={view.lastCheck.status === "verified" ? "success" : view.lastCheck.status === "invalid" ? "error" : "warn"} title={`Last test: ${fmtDateTime(view.lastCheck.at)}`}>
            {view.lastCheck.message}{lastResult?.webhookNote ? ` ${lastResult.webhookNote}` : ""}
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save()} loading={busy === "save"} disabled={!editable || !dirty || !!busy}><KeyRound className="h-4 w-4" /> Save credentials</Button>
          <Button variant="outline" onClick={() => { setKeyId(view.keyId); setKeySecret(""); setWebhookSecret(""); setErrors({}); }} disabled={!dirty || !!busy}>Cancel</Button>
          <Button variant="outline" onClick={verify} loading={busy === "verify"} disabled={!canEdit || dirty || !!busy || !view.keyId || !view.keySecretConfigured}><PlugZap className="h-4 w-4" /> Test connection</Button>
          {editable && view.keySecretConfigured && <Button variant="ghost" onClick={() => setClearField("keySecret")} disabled={!!busy}>Remove key secret</Button>}
          {editable && view.webhookSecretConfigured && <Button variant="ghost" onClick={() => setClearField("webhookSecret")} disabled={!!busy}>Remove webhook secret</Button>}
        </div>
        {dirty && <p className="text-xs text-slate-500">Save before testing. Saving a new Key ID or Key Secret resets verification and turns checkout off for this mode until they pass the test.</p>}
      </div>
      <ConfirmDialog open={!!clearField} onClose={() => setClearField(null)} title="Remove this secret?" confirmLabel="Remove" onConfirm={() => save([clearField!])}>
        Checkout for {view.mode} mode stops working until a new secret is saved and verified.
      </ConfirmDialog>
      {guard}
    </Section>
  );
}
