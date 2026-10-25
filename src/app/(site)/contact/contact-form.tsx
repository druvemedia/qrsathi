"use client";
import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

const TOPICS = [
  ["account", "Account & sign-in"], ["billing", "Plans & billing"], ["product", "Using the product"], ["bug", "Something isn't working"], ["other", "Something else"],
] as const;

type Errors = Partial<Record<"name" | "email" | "message" | "_", string>>;

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", topic: "product", message: "", website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined, _: undefined }));
  };

  const validate = () => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid e-mail address";
    if (form.message.trim().length < 10) e.message = "Please write at least 10 characters";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await api("/api/contact", { method: "POST", json: form });
      setDone(true);
    } catch (e) {
      const m = e instanceof FetchError ? /^(name|email|message): (.+)$/.exec(e.message) : null;
      setErrors(m ? { [m[1]]: m[2] } : { _: e instanceof Error ? e.message : "Couldn't send your message" });
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="animate-scale-in rounded-3xl bg-emerald-50 p-8 text-center ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/25" role="status">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <p className="mt-3 font-serif text-2xl">Message sent</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">We&apos;ll reply to {form.email}.</p>
        <button type="button" className="mt-4 text-sm font-medium text-brand hover:underline" onClick={() => { setDone(false); setForm((f) => ({ ...f, message: "" })); }}>Send another</button>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {errors._ && <Alert tone="error">{errors._}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="c-name" error={errors.name} required>
          <Input id="c-name" autoComplete="name" maxLength={100} value={form.name} onChange={set("name")} invalid={!!errors.name} />
        </Field>
        <Field label="E-mail" htmlFor="c-email" error={errors.email} required>
          <Input id="c-email" type="email" autoComplete="email" maxLength={200} value={form.email} onChange={set("email")} invalid={!!errors.email} />
        </Field>
      </div>
      <Field label="Topic" htmlFor="c-topic">
        <Select id="c-topic" value={form.topic} onChange={set("topic")}>
          {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </Field>
      <Field label="Message" htmlFor="c-message" error={errors.message} hint={`${form.message.length}/4000 · don't include passwords, OTPs or card details`} required>
        <Textarea id="c-message" rows={6} maxLength={4000} value={form.message} onChange={set("message")} invalid={!!errors.message} />
      </Field>
      {/* Honeypot — hidden from people and assistive tech. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor="c-website">Website</label>
        <input id="c-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto"><Send className="h-4 w-4" /> Send message</Button>
    </form>
  );
}
