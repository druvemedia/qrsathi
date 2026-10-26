"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, LoadingSkeleton, Section, Stepper } from "@/components/ui";
import { fmtDateTime, useAdminApi, useAdminData } from "@/components/admin/data";

interface Status { enabled: boolean; enabledAt: string | null; recoveryCodesRemaining: number; required: boolean }

function CodeInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Input id={id} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code"
      placeholder="123456" maxLength={6} className="w-40 font-mono tracking-[0.3em]" />
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = `QRSathi admin recovery codes (each works once)\n\n${codes.join("\n")}\n`;
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "qrsathi-admin-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
    setSaved(true);
  };
  return (
    <Section title="Save your recovery codes" description="Shown once. Each code signs you in once if you lose your phone. Store them in a password manager.">
      <Alert tone="warn" className="mb-4">These codes won&apos;t be shown again. Without them or your authenticator, only another super administrator or the server operator can restore access.</Alert>
      <ul className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm dark:bg-slate-800/60 sm:grid-cols-2" aria-label="Recovery codes">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(text).then(() => { setSaved(true); toast.success("Copied"); })}><Copy className="h-4 w-4" /> Copy</Button>
        <Button variant="outline" onClick={download}><Download className="h-4 w-4" /> Download .txt</Button>
        <Button onClick={onDone} disabled={!saved}>I&apos;ve saved them</Button>
      </div>
    </Section>
  );
}

export function MfaView() {
  const call = useAdminApi();
  const router = useRouter();
  const { data, error, loading, reload } = useAdminData<Status>("/api/admin/mfa");
  const [setup, setSetup] = useState<{ secret: string; otpauth: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [regen, setRegen] = useState(false);
  const [disable, setDisable] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => { if (setup) setCode(""); }, [setup]);

  const begin = async () => {
    setBusy(true);
    try {
      const r = await call<{ secret: string; otpauth: string }>("/api/admin/mfa", { method: "POST", json: { action: "setup" } });
      const qr = await QRCode.toDataURL(r.otpauth, { margin: 1, width: 220, errorCorrectionLevel: "M" });
      setSetup({ ...r, qr });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start setup");
    } finally {
      setBusy(false);
    }
  };
  const post = async (json: Record<string, string>) => {
    setBusy(true);
    try {
      return await call<{ ok: boolean; recoveryCodes?: string[] }>("/api/admin/mfa", { method: "POST", json });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work");
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert tone="error" title="Couldn't load two-factor status">{error}</Alert>;
  if (loading || !data) return <LoadingSkeleton rows={4} />;
  if (codes) return <div className="max-w-2xl"><RecoveryCodes codes={codes} onDone={() => { setCodes(null); setSetup(null); reload(); router.refresh(); }} /></div>;

  if (!data.enabled)
    return (
      <div className="max-w-2xl space-y-6">
        {data.required && <Alert tone="warn" title="Required for administrators">You must enable two-factor authentication before you can use the rest of the admin console.</Alert>}
        {!setup ? (
          <Section title="Status" actions={<Badge tone="rose">Not enabled</Badge>}>
            <p className="text-sm text-slate-600 dark:text-slate-300">Two-factor authentication is <strong>not</strong> enabled for your account. Signing in needs only your password.</p>
            <Button className="mt-4" onClick={begin} loading={busy}><ShieldCheck className="h-4 w-4" /> Set up authenticator app</Button>
          </Section>
        ) : (
          <Section title="Set up your authenticator">
            <Stepper steps={["Scan", "Verify", "Save codes"]} current={code.length === 6 ? 1 : 0} className="mb-5" />
            <div className="flex flex-col gap-6 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL */}
              <img src={setup.qr} alt="QR code for your authenticator app" width={220} height={220} className="h-[220px] w-[220px] shrink-0 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700" />
              <div className="min-w-0 space-y-4 text-sm">
                <p>1. Scan this QR code with your authenticator app.</p>
                <div>
                  <p className="text-slate-500">Can&apos;t scan? Enter this key manually:</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs dark:bg-slate-800">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                    <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(setup.secret).then(() => toast.success("Key copied"))} aria-label="Copy setup key"><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await post({ action: "enable", code });
                  if (r?.recoveryCodes) { setCodes(r.recoveryCodes); toast.success("Two-factor authentication enabled"); }
                }} className="space-y-3">
                  <Field label="2. Enter the 6-digit code it shows" htmlFor="mfa-code"><CodeInput id="mfa-code" value={code} onChange={setCode} /></Field>
                  <div className="flex gap-2">
                    <Button type="submit" loading={busy} disabled={code.length !== 6}>Verify & enable</Button>
                    <Button variant="ghost" onClick={() => setSetup(null)}>Cancel</Button>
                  </div>
                </form>
              </div>
            </div>
          </Section>
        )}
      </div>
    );

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="Status" actions={<Badge tone="green">Enabled</Badge>}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Enabled</dt><dd className="font-medium">{fmtDateTime(data.enabledAt)}</dd></div>
          <div><dt className="text-xs text-slate-500">Unused recovery codes</dt><dd className="font-medium">{data.recoveryCodesRemaining} of 10</dd></div>
        </dl>
        {data.recoveryCodesRemaining <= 3 && <Alert tone="warn" className="mt-4">You&apos;re running low on recovery codes. Generate a new set.</Alert>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setCode(""); setRegen(true); }}>Generate new recovery codes</Button>
          {!data.required && <Button variant="outline" onClick={() => { setCode(""); setPassword(""); setDisable(true); }}>Turn off</Button>}
        </div>
        {data.required && <p className="mt-3 text-xs text-slate-500">Two-factor authentication is required for administrators and can&apos;t be turned off.</p>}
      </Section>

      <ConfirmDialog open={regen} onClose={() => setRegen(false)} tone="primary" title="Generate new recovery codes?" confirmLabel="Generate"
        onConfirm={async () => {
          const r = await post({ action: "regenerate", code });
          if (r?.recoveryCodes) { setRegen(false); setCodes(r.recoveryCodes); }
        }}>
        <p>Your existing recovery codes stop working.</p>
        <Field label="Current authenticator code" htmlFor="regen-code" className="mt-3"><CodeInput id="regen-code" value={code} onChange={setCode} /></Field>
      </ConfirmDialog>
      <ConfirmDialog open={disable} onClose={() => setDisable(false)} title="Turn off two-factor authentication?" confirmLabel="Turn off"
        onConfirm={async () => {
          const r = await post({ action: "disable", code, password });
          if (r?.ok) { setDisable(false); toast.success("Two-factor authentication turned off"); reload(); router.refresh(); }
        }}>
        <p>Your account will be protected by your password only.</p>
        <Field label="Current authenticator code" htmlFor="dis-code" className="mt-3"><CodeInput id="dis-code" value={code} onChange={setCode} /></Field>
        <Field label="Password" htmlFor="dis-pw" className="mt-3"><Input id="dis-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      </ConfirmDialog>
    </div>
  );
}
