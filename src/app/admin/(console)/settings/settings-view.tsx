"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Alert, Button, Field, LoadingSkeleton, Section, Switch, Textarea } from "@/components/ui";
import { useAdminApi, useAdminData } from "@/components/admin/data";
import { useUnsavedGuard } from "@/components/admin/guards";
import { FetchError } from "@/lib/fetcher";

interface General { announcement: string; allowSignups: boolean }

export function SettingsView() {
  const call = useAdminApi();
  const { data, error, loading, reload } = useAdminData<{ settings: General }>("/api/admin/settings");
  const [s, setS] = useState<General | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  useEffect(() => { if (data) setS(data.settings); }, [data]);
  const dirty = !!s && !!data && JSON.stringify(s) !== JSON.stringify(data.settings);
  const guard = useUnsavedGuard(dirty);

  if (error) return <Alert tone="error" title="Couldn't load settings">{error} <button onClick={reload} className="font-medium underline">Retry</button></Alert>;
  if (loading || !s) return <LoadingSkeleton rows={4} />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFieldError("");
    try {
      await call("/api/admin/settings", { method: "PUT", json: s });
      toast.success("Settings saved");
      reload();
    } catch (err) {
      const m = err instanceof FetchError ? /^(\w+): (.+)$/.exec(err.message) : null;
      if (m) setFieldError(m[2]);
      toast.error(err instanceof Error ? err.message : "Couldn't save settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6" noValidate>
      <Alert tone="info">Site name, descriptions, contact details, logos and colours are managed in <Link href="/admin/settings/branding" className="font-medium underline">Website branding</Link> and <Link href="/admin/settings/appearance" className="font-medium underline">Appearance</Link>.</Alert>
      <Section title="Site behaviour">
        <div className="space-y-4">
          <Field label="Announcement banner" htmlFor="s-ann" error={fieldError} hint="Shown at the top of public pages. Plain text; leave empty to hide.">
            <Textarea id="s-ann" rows={2} value={s.announcement} maxLength={200} onChange={(e) => setS({ ...s, announcement: e.target.value })} />
          </Field>
          <Switch checked={s.allowSignups} onChange={(v) => setS({ ...s, allowSignups: v })} label="Allow new sign-ups"
            description="When off, nobody can create a new account (password or Google). Administrators are created with the server-side admin CLI." />
        </div>
      </Section>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy} disabled={!dirty}>Save settings</Button>
        {dirty && <Button variant="ghost" onClick={() => setS(data!.settings)}>Discard changes</Button>}
        <p className="text-xs text-slate-500">Changes are recorded in the audit log.</p>
      </div>
      {guard}
    </form>
  );
}
