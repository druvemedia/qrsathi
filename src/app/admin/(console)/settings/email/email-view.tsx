"use client";
import { useState } from "react";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, LoadingSkeleton, Section } from "@/components/ui";
import { useAdminApi, useAdminData } from "@/components/admin/data";

interface Resp { configured: boolean; host: string; port: number; security: string; authConfigured: boolean; from: string }

export function EmailView() {
  const call = useAdminApi();
  const { data, error, loading } = useAdminData<Resp>("/api/admin/email");
  const [busy, setBusy] = useState(false);
  if (error) return <Alert tone="error">{error}</Alert>;
  if (loading || !data) return <LoadingSkeleton rows={4} />;
  const test = async () => {
    setBusy(true);
    try {
      const r = await call<{ to: string }>("/api/admin/email", { method: "POST", json: {} });
      toast.success(`Test e-mail sent to ${r.to}`, { description: "Check the inbox (and spam folder)." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-3xl space-y-6">
      <Section title="SMTP" actions={data.configured ? <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Configured</Badge> : <Badge tone="rose"><XCircle className="h-3 w-3" /> Not configured</Badge>}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Server</dt><dd className="font-mono">{data.host || "—"}{data.host && `:${data.port}`}</dd></div>
          <div><dt className="text-xs text-slate-500">Encryption</dt><dd>{data.configured ? data.security : "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Authentication</dt><dd>{data.authConfigured ? "Username and password set" : "None"}</dd></div>
          <div><dt className="text-xs text-slate-500">From address</dt><dd className="break-all">{data.from || "—"}</dd></div>
        </dl>
        <Button className="mt-5" variant="outline" onClick={test} loading={busy} disabled={!data.configured}><Send className="h-4 w-4" /> Send a test e-mail to me</Button>
      </Section>
      {!data.configured && (
        <Alert tone="info" title="How to configure">
          Set <code>SMTP_HOST</code>, <code>SMTP_PORT</code> (587 or 465), <code>SMTP_USER</code>, <code>SMTP_PASS</code> and <code>MAIL_FROM</code> in the server environment and restart. Use a transactional provider (Amazon SES, Postmark, Mailgun, Zoho) with SPF, DKIM and DMARC for the sending domain.
        </Alert>
      )}
    </div>
  );
}
