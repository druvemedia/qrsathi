"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Flag } from "lucide-react";
import { api } from "@/lib/fetcher";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

export function ReportForm() {
  const sp = useSearchParams();
  const [f, setF] = useState({ url: sp.get("code") ? `/r/${sp.get("code")}` : "", shortCode: sp.get("code") || "", reason: "phishing", details: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/reports", { method: "POST", json: f });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };
  if (done) return <Alert tone="success" title="Thank you — report received">Our team will review it. If the QR code breaks our rules it will be disabled.</Alert>;
  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="QR link or short code" hint="The address the QR opened, e.g. https://…/r/abc1234"><Input required value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} maxLength={2000} /></Field>
        <Field label="Reason">
          <Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
            <option value="phishing">Phishing / fake login page</option>
            <option value="payment_fraud">Payment fraud (fake UPI request, “refund” scam)</option>
            <option value="scam">Other scam</option>
            <option value="malware">Malware / suspicious app download</option>
            <option value="illegal">Illegal content</option>
            <option value="spam">Spam</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="What happened?"><Textarea rows={4} maxLength={2000} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></Field>
        <Field label="Your email (optional)" hint="Only used if we need more information."><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Button type="submit" loading={busy}><Flag className="h-4 w-4" /> Submit report</Button>
      </form>
    </Card>
  );
}
