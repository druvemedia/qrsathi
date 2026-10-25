"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LayoutTemplate, Palette } from "lucide-react";
import { toast } from "sonner";
import { Alert, Field, LoadingSkeleton, Switch, Textarea } from "@/components/ui";
import { useAdminApi, useAdminData } from "@/components/admin/data";
import { useUnsavedGuard } from "@/components/admin/guards";
import { SaveBar, SettingsGroup } from "@/components/admin/settings-ui";
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
    <form onSubmit={save} className="max-w-4xl" noValidate>
      <SettingsGroup id="behaviour" title="Site behaviour" description="Applies to every public page immediately after saving.">
        <Field label="Announcement banner" htmlFor="s-ann" error={fieldError} hint={`${s.announcement.length}/200 · plain text; leave empty to hide`}>
          <Textarea id="s-ann" rows={2} value={s.announcement} maxLength={200} onChange={(e) => setS({ ...s, announcement: e.target.value })} />
        </Field>
        <div aria-label="Banner preview">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Preview</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            {s.announcement.trim()
              ? <div className="border-b border-zinc-200 bg-white px-4 py-2 text-center text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" aria-hidden />{s.announcement}</div>
              : <div className="px-4 py-2 text-center text-xs text-slate-400">No banner is shown</div>}
            <div className="flex h-10 items-center gap-3 bg-[#fbfbf9] px-4 dark:bg-[#0b0b0d]" aria-hidden><span className="h-2 w-16 rounded-full bg-zinc-300 dark:bg-zinc-700" /><span className="h-2 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" /><span className="h-2 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" /></div>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup id="signups" title="Sign-ups" description="Administrators are never created from the website.">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <Switch checked={s.allowSignups} onChange={(v) => setS({ ...s, allowSignups: v })} label="Allow new sign-ups"
            description="When off, nobody can create a new account (password or Google). Administrators are created with the server-side admin CLI." />
        </div>
      </SettingsGroup>

      <SettingsGroup id="more" title="Branding & appearance" description="Managed on their own pages.">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { href: "/admin/settings/branding", icon: LayoutTemplate, title: "Website branding", text: "Name, descriptions, contact, social links, logos" },
            { href: "/admin/settings/appearance", icon: Palette, title: "Appearance", text: "Colours, default theme, header" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:shadow-card dark:border-slate-800 dark:bg-slate-900">
              <l.icon className="h-5 w-5 text-brand" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{l.title}</span><span className="block truncate text-xs text-slate-500">{l.text}</span></span>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      </SettingsGroup>

      <SaveBar dirty={dirty} busy={busy} onCancel={() => setS(data!.settings)} saveLabel="Save settings" note="Changes are recorded in the audit log." />
      {guard}
    </form>
  );
}
