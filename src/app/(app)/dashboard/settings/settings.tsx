"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CreditCard, FileText, KeyRound, Monitor, Moon, Palette, Shield, SlidersHorizontal, Sun, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { isAdminRole } from "@/lib/roles";
import { formatDate, formatNumber, cn } from "@/lib/utils";
import { QR_TYPES } from "@/lib/qr-types";
import { TEMPLATES } from "@/lib/templates";
import { BARCODE_FORMATS, LABEL_SIZES } from "@/lib/barcodes";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Preferences } from "@/lib/preferences";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, LinkButton, Section, Select, Skeleton } from "@/components/ui";
import { useApp, type ThemePref } from "@/components/providers";

interface Upload { id: string; filename: string; size: number; mime: string; createdAt: string; url: string }
interface Account {
  plan: { name: string; dynamicLimit: number; hostedLimit: number; savedLimit: number; productLimit?: number; bulkRows: number; analyticsDays: number };
  usage: { saved: number; dynamic: number; hosted: number; downloads: number };
}

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "defaults", label: "Defaults", icon: SlidersHorizontal },
  { id: "security", label: "Account & security", icon: KeyRound },
  { id: "plan", label: "Plan & usage", icon: CreditCard },
  { id: "files", label: "Uploaded files", icon: FileText },
  { id: "danger", label: "Delete account", icon: Trash2 },
];

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-slate-600 dark:text-slate-300">{label}</span><span className="tabular-nums text-slate-500">{formatNumber(used)} / {formatNumber(limit)}</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemax={limit}>
        <div className={cn("h-full rounded-full", pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AccountSettings() {
  const { user, setUser, themePref, setThemePref } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = useState(user?.name || "");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[] | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [delOpen, setDelOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [products, setProducts] = useState<number | null>(null);
  const [removeFile, setRemoveFile] = useState<Upload | null>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
    api<{ items: Upload[] }>("/api/uploads").then((r) => setUploads(r.items)).catch(() => setUploads([]));
    api<Account>("/api/account").then(setAccount).catch(() => {});
    api<{ counts: { products: number } }>("/api/overview").then((r) => setProducts(r.counts.products)).catch(() => {});
  }, []);
  useEffect(() => {
    if (sp.get("billing") === "return") toast.info("Payment submitted. Your plan updates as soon as the payment provider confirms it — usually within a minute.");
  }, [sp]);

  if (!user) return null;
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(null); }
  };
  const updatePrefs = (p: Partial<Preferences>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(next);
    toast.success("Default saved");
  };
  const pwMismatch = !!pw.confirm && pw.confirm !== pw.next;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-thin lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
                <s.icon className="h-4 w-4 text-slate-400" aria-hidden /> {s.label}
              </a>
            </li>
          ))}
          {isAdminRole(user.role) && (
            <li><Link href="/admin/login" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><Shield className="h-4 w-4 text-slate-400" aria-hidden /> Admin console</Link></li>
          )}
        </ul>
      </nav>

      <div className="min-w-0 space-y-6 [&>section]:scroll-mt-20">
        <Section id="profile" title="Profile" description="How you appear in QRSathi.">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("name", async () => { const r = await api("/api/account", { method: "PATCH", json: { name } }); setUser(r.user); toast.success("Profile updated"); }); }}>
            <Field label="Name" htmlFor="s-name" required><Input id="s-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Email" htmlFor="s-email" hint={user.google ? "Linked with Google sign-in." : "Contact support to change your email."}><Input id="s-email" value={user.email} disabled /></Field>
            <div className="sm:col-span-2"><Button type="submit" loading={busy === "name"} disabled={!name.trim() || name === user.name}>Save profile</Button></div>
          </form>
        </Section>

        <Section id="appearance" title="Appearance" description="Saved on this device.">
          <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
            {([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as [ThemePref, string, typeof Sun][]).map(([v, label, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={themePref === v} onClick={() => setThemePref(v)}
                className={cn("flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                  themePref === v ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-200 hover:border-slate-300 dark:border-slate-700")}>
                <Icon className="h-4 w-4 text-slate-500" aria-hidden />
                <span><span className="block font-medium">{label}</span><span className="text-xs text-slate-500">{v === "system" ? "Follow your device" : `Always ${label.toLowerCase()}`}</span></span>
              </button>
            ))}
          </div>
        </Section>

        <Section id="defaults" title="Generator defaults" description="Used when you start a new QR code or barcode on this device.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default QR type" htmlFor="d-qr"><Select id="d-qr" value={prefs.qrType} onChange={(e) => updatePrefs({ qrType: e.target.value })}>{QR_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></Field>
            <Field label="Default QR style" htmlFor="d-tpl"><Select id="d-tpl" value={prefs.qrTemplate} onChange={(e) => updatePrefs({ qrTemplate: e.target.value })}><option value="">Classic (black & white)</option>{TEMPLATES.filter((t) => t.id !== "classic").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <Field label="Default barcode format" htmlFor="d-bc"><Select id="d-bc" value={prefs.barcodeFormat} onChange={(e) => updatePrefs({ barcodeFormat: e.target.value })}>{BARCODE_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</Select></Field>
            <Field label="Default label size" htmlFor="d-lbl"><Select id="d-lbl" value={prefs.labelSize} onChange={(e) => updatePrefs({ labelSize: e.target.value })}>{LABEL_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
          </div>
          <p className="hint">Defaults apply to new work. A draft you&apos;re already editing keeps its own settings.</p>
        </Section>

        <Section id="security" title="Account & security">
          <div className="space-y-6">
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("pw", async () => {
              const r = await api("/api/account", { method: "PATCH", json: { currentPassword: pw.current, newPassword: pw.next } });
              setUser(r.user); setPw({ current: "", next: "", confirm: "" }); toast.success("Password updated — other devices were signed out");
            }); }}>
              <h3 className="text-sm font-medium sm:col-span-2">{user.hasPassword ? "Change password" : "Set a password"}</h3>
              {user.hasPassword && <Field label="Current password" htmlFor="pw-cur" className="sm:col-span-2"><Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>}
              <Field label="New password" htmlFor="pw-new" hint="8+ characters with a letter and a number."><Input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
              <Field label="Confirm new password" htmlFor="pw-conf" error={pwMismatch ? "Passwords don't match" : undefined}><Input id="pw-conf" type="password" autoComplete="new-password" value={pw.confirm} invalid={pwMismatch} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Button type="submit" loading={busy === "pw"} disabled={!pw.next || pw.next !== pw.confirm}>Update password</Button></div>
            </form>
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="text-sm font-medium">Sessions</h3><p className="text-xs text-slate-500">Signed in somewhere you don&apos;t recognise? This device stays signed in.</p></div>
              <Button variant="outline" loading={busy === "sess"} onClick={() => run("sess", async () => { await api("/api/account/sessions", { method: "POST" }); toast.success("Other sessions signed out"); })}>Sign out other devices</Button>
            </div>
          </div>
        </Section>

        <Section id="plan" title="Plan & usage" actions={<LinkButton href="/pricing" variant="outline" size="sm">Compare plans</LinkButton>}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone="brand" className="px-2 py-1 text-xs">{user.planName} plan</Badge>
            {user.planExpiresAt && <span className="text-xs text-slate-500">Renews / ends {formatDate(user.planExpiresAt)}</span>}
          </div>
          {!account ? <Skeleton className="h-28" /> : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Meter label="Saved QR codes" used={account.usage.saved} limit={account.plan.savedLimit} />
              <Meter label="Dynamic QR codes" used={account.usage.dynamic} limit={account.plan.dynamicLimit} />
              <Meter label="Hosted pages" used={account.usage.hosted} limit={account.plan.hostedLimit} />
              {account.plan.productLimit !== undefined && products !== null && <Meter label="Products" used={products} limit={account.plan.productLimit} />}
            </div>
          )}
          <p className="hint mt-4">Plans change only after the payment provider confirms payment. Bulk batches: up to {account ? formatNumber(account.plan.bulkRows) : "…"} rows · Analytics history: {account?.plan.analyticsDays ?? "…"} days.</p>
        </Section>

        <Section id="files" title="Uploaded files" description="Files linked from your PDF/File QR codes." bodyClassName="p-0">
          {!uploads ? <div className="p-5"><Skeleton className="h-12" /></div> : uploads.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">No uploads yet. Upload PDFs or images from the PDF / File QR type.</p> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {uploads.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <a href={u.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-medium hover:text-brand">{u.filename}</a>
                  <span className="shrink-0 text-xs text-slate-500">{(u.size / 1024 / 1024).toFixed(2)} MB</span>
                  <Button variant="ghost" size="sm" aria-label={`Delete ${u.filename}`} onClick={() => setRemoveFile(u)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="danger" title="Delete account" className="border-rose-200 dark:border-rose-500/30">
          <p className="text-sm text-slate-600 dark:text-slate-300">Permanently deletes your account, QR codes, products, inventory history, analytics and uploaded files. Dynamic QR codes and hosted pages stop working immediately.</p>
          <Button className="mt-4" variant="danger" onClick={() => setDelOpen(true)}>Delete my account…</Button>
        </Section>
      </div>

      <ConfirmDialog open={!!removeFile} onClose={() => setRemoveFile(null)} title="Delete this file?" confirmLabel="Delete file"
        onConfirm={() => run("up", async () => {
          await api(`/api/uploads?id=${removeFile!.id}`, { method: "DELETE" });
          setUploads((l) => l?.filter((x) => x.id !== removeFile!.id) ?? null);
          setRemoveFile(null);
          toast.success("File deleted");
        })}>
        “{removeFile?.filename}” will be removed. QR codes that link to it will show “not found”.
      </ConfirmDialog>

      <ConfirmDialog open={delOpen} onClose={() => setDelOpen(false)} title="Delete account permanently?" confirmLabel="Delete forever" loading={busy === "del"}
        onConfirm={() => {
          if (confirm.trim().toLowerCase() !== user.email) { toast.error("Type your email address exactly to confirm."); return; }
          return run("del", async () => { await api("/api/account", { method: "DELETE", json: { confirm } }); setUser(null); toast.success("Account deleted"); router.push("/"); router.refresh(); });
        }}>
        <p>This can&apos;t be undone.</p>
        <Field label={<>Type <strong>{user.email}</strong> to confirm</>} htmlFor="del-confirm" className="mt-3"><Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></Field>
      </ConfirmDialog>

      {isAdminRole(user.role) && (
        <Alert tone="info" icon={<Shield className="h-4 w-4" />} className="lg:col-start-2">
          You&apos;re an administrator. Users, moderation, plans and site settings are managed in the separate <Link href="/admin/login" className="font-medium underline">admin console</Link>, which has its own sign-in.
        </Alert>
      )}
    </div>
  );
}
