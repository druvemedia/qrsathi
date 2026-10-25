"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, Button, Field, Input, LoadingSkeleton, Section, Switch, Textarea } from "@/components/ui";
import { useAdminApi, useAdminData } from "@/components/admin/data";
import { BRAND_COLORS, type SiteSettings } from "@/lib/brand";
import { FetchError } from "@/lib/fetcher";

export function SettingsView() {
  const call = useAdminApi();
  const { data, error, loading, reload } = useAdminData<{ settings: SiteSettings }>("/api/admin/settings");
  const [s, setS] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setS(data.settings); }, [data]);

  if (error) return <Alert tone="error" title="Couldn't load settings">{error} <button onClick={reload} className="font-medium underline">Retry</button></Alert>;
  if (loading || !s) return <LoadingSkeleton rows={6} />;

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setS({ ...s, [k]: v });
  const dirty = JSON.stringify(s) !== JSON.stringify(data?.settings);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFieldErrors({});
    try {
      await call("/api/admin/settings", { method: "PUT", json: s });
      toast.success("Settings saved", { description: "Reload other tabs to see branding changes." });
      reload();
    } catch (err) {
      // Validation errors arrive as "field: message".
      const m = err instanceof FetchError ? /^(\w+): (.+)$/.exec(err.message) : null;
      if (m) setFieldErrors({ [m[1]]: m[2] });
      toast.error(err instanceof Error ? err.message : "Couldn't save settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6" noValidate>
      <Section title="Branding">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site name" htmlFor="s-name" error={fieldErrors.siteName} required><Input id="s-name" value={s.siteName} maxLength={40} onChange={(e) => set("siteName", e.target.value)} /></Field>
            <Field label="Company / legal name" htmlFor="s-company" error={fieldErrors.companyName} required><Input id="s-company" value={s.companyName} maxLength={100} onChange={(e) => set("companyName", e.target.value)} /></Field>
          </div>
          <Field label="Tagline" htmlFor="s-tagline" error={fieldErrors.tagline}><Input id="s-tagline" value={s.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} /></Field>
          <Field label="Support e-mail" htmlFor="s-support" error={fieldErrors.supportEmail} hint="Shown on legal and help pages. Leave empty to hide.">
            <Input id="s-support" type="email" value={s.supportEmail} maxLength={200} onChange={(e) => set("supportEmail", e.target.value)} />
          </Field>
          <fieldset>
            <legend className="label">Brand colour</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(BRAND_COLORS).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set("brand", k)} aria-pressed={s.brand === k}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${s.brand === k ? "border-slate-900 ring-2 ring-slate-900/10 dark:border-white" : "border-slate-200 dark:border-slate-700"}`}>
                  <span className="h-4 w-4 rounded-full" style={{ background: `hsl(${v.hsl})` }} aria-hidden /> {v.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </Section>
      <Section title="Site behaviour">
        <div className="space-y-4">
          <Field label="Announcement banner" htmlFor="s-ann" error={fieldErrors.announcement} hint="Shown at the top of public and workspace pages. Plain text only; leave empty to hide.">
            <Textarea id="s-ann" rows={2} value={s.announcement} maxLength={200} onChange={(e) => set("announcement", e.target.value)} />
          </Field>
          <Switch checked={s.allowSignups} onChange={(v) => set("allowSignups", v)} label="Allow new sign-ups"
            description="When off, nobody can create a new account (password or Google). Administrators are created with the server-side admin CLI." />
        </div>
      </Section>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy} disabled={!dirty}>Save settings</Button>
        {dirty && <Button variant="ghost" onClick={() => setS(data!.settings)}>Discard changes</Button>}
        <p className="text-xs text-slate-500">Changes are recorded in the audit log.</p>
      </div>
    </form>
  );
}
