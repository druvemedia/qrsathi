"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CreditCard, FileText, KeyRound, LogOut, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Button, Card, Field, Input, Modal } from "@/components/ui";
import { useApp } from "@/components/providers";

interface Upload { id: string; filename: string; size: number; mime: string; createdAt: string; url: string }

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold"><Icon className="h-5 w-5 text-brand" /> {title}</h2>
      {children}
    </Card>
  );
}

export function AccountSettings() {
  const { user, setUser } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = useState(user?.name || "");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [delOpen, setDelOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  useEffect(() => { api<{ items: Upload[] }>("/api/uploads").then((r) => setUploads(r.items)).catch(() => {}); }, []);
  useEffect(() => {
    if (sp.get("billing") === "return") toast.info("Payment submitted. Your plan updates as soon as the payment provider confirms it — usually within a minute.");
  }, [sp]);

  if (!user) return null;
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(null); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section icon={User} title="Profile">
        <div className="space-y-4">
          <Field label="Name"><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email" hint={user.google ? "Linked with Google sign-in." : undefined}><Input value={user.email} disabled /></Field>
          <Button loading={busy === "name"} onClick={() => run("name", async () => {
            const r = await api("/api/account", { method: "PATCH", json: { name } });
            setUser(r.user); toast.success("Profile updated");
          })}>Save profile</Button>
        </div>
      </Section>

      <Section icon={CreditCard} title="Plan & billing">
        <div className="flex items-center gap-3">
          <Badge tone="brand" className="px-3 py-1 text-sm">{user.planName}</Badge>
          {user.planExpiresAt && <span className="text-sm text-slate-500">Renews / ends {formatDate(user.planExpiresAt)}</span>}
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Plans change only after the payment provider confirms payment. Scanning a QR or reaching a checkout page never counts as payment.</p>
        <Link href="/pricing" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Compare plans →</Link>
      </Section>

      <Section icon={KeyRound} title={user.hasPassword ? "Change password" : "Set a password"}>
        <div className="space-y-3">
          {user.hasPassword && <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>}
          <Field label="New password" hint="8+ characters with a letter and a number."><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Field label="Confirm new password" error={pw.confirm && pw.confirm !== pw.next ? "Passwords don't match" : undefined}><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          <Button loading={busy === "pw"} disabled={!pw.next || pw.next !== pw.confirm} onClick={() => run("pw", async () => {
            const r = await api("/api/account", { method: "PATCH", json: { currentPassword: pw.current, newPassword: pw.next } });
            setUser(r.user); setPw({ current: "", next: "", confirm: "" }); toast.success("Password updated — other devices were signed out");
          })}>Update password</Button>
        </div>
      </Section>

      <Section icon={LogOut} title="Sessions">
        <p className="text-sm text-slate-600 dark:text-slate-300">Signed in somewhere you don&apos;t recognise? Sign out of every other device. This device stays signed in.</p>
        <Button className="mt-4" variant="outline" loading={busy === "sess"} onClick={() => run("sess", async () => { await api("/api/account/sessions", { method: "POST" }); toast.success("Other sessions signed out"); })}>Sign out other devices</Button>
      </Section>

      <Section icon={FileText} title="Uploaded files">
        {uploads.length === 0 ? <p className="text-sm text-slate-500">No uploads yet. Upload PDFs or images from the PDF/File QR type.</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <a href={u.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-medium hover:text-brand">{u.filename}</a>
                <span className="shrink-0 text-xs text-slate-500">{(u.size / 1024 / 1024).toFixed(2)} MB</span>
                <button aria-label={`Delete ${u.filename}`} className="shrink-0 text-slate-400 hover:text-rose-600" onClick={() => run("up" + u.id, async () => {
                  await api(`/api/uploads?id=${u.id}`, { method: "DELETE" }); setUploads((l) => l.filter((x) => x.id !== u.id)); toast.success("File deleted — QR codes linking to it will show “not found”");
                })}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Trash2} title="Delete account">
        <Alert tone="error">Permanently deletes your account, all QR codes, analytics and uploaded files. Dynamic QR codes and hosted pages stop working immediately.</Alert>
        <Button className="mt-4" variant="danger" onClick={() => setDelOpen(true)}>Delete my account</Button>
      </Section>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete account permanently?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button variant="danger" disabled={confirm.trim().toLowerCase() !== user.email} loading={busy === "del"} onClick={() => run("del", async () => {
            await api("/api/account", { method: "DELETE", json: { confirm } }); setUser(null); toast.success("Account deleted"); router.push("/"); router.refresh();
          })}>Delete forever</Button></>}>
        <Field label={<>Type <strong>{user.email}</strong> to confirm</>}><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></Field>
      </Modal>
    </div>
  );
}
