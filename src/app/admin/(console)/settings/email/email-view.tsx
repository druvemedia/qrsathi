"use client";
import { useState } from "react";
import { MailCheck, MailX, Send } from "lucide-react";
import { toast } from "sonner";
import { Alert, Button, Disclosure, LoadingSkeleton } from "@/components/ui";
import { useAdminApi, useAdminData } from "@/components/admin/data";
import { SettingsGroup, StatusHero } from "@/components/admin/settings-ui";

interface Resp { configured: boolean; host: string; port: number; security: string; authConfigured: boolean; from: string }

export function EmailView() {
  const call = useAdminApi();
  const { data, error, loading } = useAdminData<Resp>("/api/admin/email");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  if (error) return <Alert tone="error">{error}</Alert>;
  if (loading || !data) return <LoadingSkeleton rows={4} />;
  const test = async () => {
    setBusy(true);
    try {
      const r = await call<{ to: string }>("/api/admin/email", { method: "POST", json: {} });
      setSentTo(r.to);
      toast.success(`Test e-mail sent to ${r.to}`, { description: "Check the inbox (and spam folder)." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy(false);
    }
  };
  const rows: [string, React.ReactNode][] = [
    ["Server", <span key="s" className="font-mono">{data.host ? `${data.host}:${data.port}` : "—"}</span>],
    ["Encryption", data.configured ? data.security : "—"],
    ["Authentication", data.authConfigured ? "Username and password set" : "None"],
    ["From address", <span key="f" className="break-all">{data.from || "—"}</span>],
  ];
  return (
    <div className="max-w-4xl space-y-6">
      <StatusHero tone={data.configured ? "green" : "slate"} icon={data.configured ? <MailCheck /> : <MailX />}
        title={data.configured ? "E-mail is configured" : "E-mail isn't configured"}
        detail={data.configured ? "Password resets and contact-form messages can be delivered." : "Password-reset e-mails and the public contact form are unavailable until SMTP is set."}>
        <Button variant="outline" onClick={test} loading={busy} disabled={!data.configured}><Send className="h-4 w-4" /> Send a test e-mail to me</Button>
      </StatusHero>
      {sentTo && <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">Sent to {sentTo}. If it doesn&apos;t arrive, check the spam folder and the application log.</p>}

      <div>
        <SettingsGroup id="smtp" title="SMTP" description="Read from the server environment. Passwords are never shown.">
          <dl className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-slate-500">{k}</dt><dd className="min-w-0 text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </SettingsGroup>
        <SettingsGroup id="howto" title="How to configure" description="Changes need a server restart.">
          <Disclosure title="Environment variables" description="SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM" defaultOpen={!data.configured}>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Set <code>SMTP_HOST</code>, <code>SMTP_PORT</code> (587 or 465), <code>SMTP_USER</code>, <code>SMTP_PASS</code> and <code>MAIL_FROM</code> in the server environment and restart. Use a transactional provider (Amazon SES, Postmark, Mailgun, Zoho) with SPF, DKIM and DMARC for the sending domain.
            </p>
          </Disclosure>
        </SettingsGroup>
      </div>
    </div>
  );
}
