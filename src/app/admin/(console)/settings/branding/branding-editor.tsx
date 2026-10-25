"use client";
/* eslint-disable @next/next/no-img-element -- uploaded brand assets are served as-is from /brand */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImageUp, Moon, RotateCcw, Sun, Trash2, Undo2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, LoadingSkeleton, Section, Segmented, Textarea } from "@/components/ui";
import { useAdminApi, useAdminData } from "@/components/admin/data";
import { useUnsavedGuard } from "@/components/admin/guards";
import { FetchError } from "@/lib/fetcher";
import { BRAND_DEFAULTS, SOCIAL_NETWORKS, assetUrl, brandingSchema, contrastRatio, footerLine, hexToHslTriplet, onColor, sameValue, socialLinks, type AssetKind, type Branding } from "@/lib/branding";
import { BrandIcon } from "@/components/brand-icon";
import { SettingsGroup, SettingsNav } from "@/components/admin/settings-ui";
import { cn } from "@/lib/utils";

interface AssetRow { kind: AssetKind; storedName: string; width: number; height: number; size: number; mime: string }
interface Resp { published: Branding; draft: Branding | null; defaults: Branding; assets: AssetRow[]; rules: Record<AssetKind, { maxBytes: number; hint: string }> }

export type EditorSection = "identity" | "appearance";

export function BrandingEditor({ section }: { section: EditorSection }) {
  const call = useAdminApi();
  const { data, error, loading, reload } = useAdminData<Resp>("/api/admin/branding");
  const [form, setForm] = useState<Branding | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"" | "save" | "publish" | "discard" | "reset">("");
  const [confirm, setConfirm] = useState<null | "publish" | "discard" | "reset" | "cancel">(null);
  const [previewDark, setPreviewDark] = useState(false);
  const saved = data ? data.draft ?? data.published : null;
  useEffect(() => { if (saved) setForm(saved); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved);
  const guard = useUnsavedGuard(dirty);
  const hasDraft = !!data?.draft;
  const pendingChanges = useMemo(() => {
    if (!data || !form) return [] as (keyof Branding)[];
    return (Object.keys(form) as (keyof Branding)[]).filter((k) => !sameValue(form[k], data.published[k]));
  }, [data, form]);

  if (error) return <Alert tone="error" title="Couldn't load branding">{error} <button onClick={reload} className="font-medium underline">Retry</button></Alert>;
  if (loading || !data || !form) return <LoadingSkeleton rows={8} />;

  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => { setForm({ ...form, [k]: v }); setErrors((e) => ({ ...e, [k]: "" })); };
  const validate = () => {
    const r = brandingSchema.safeParse(form);
    if (r.success) { setErrors({}); return true; }
    setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0] === "social" ? i.path.join(".") : String(i.path[0]), i.message])));
    toast.error("Fix the highlighted fields first.");
    return false;
  };
  const saveDraft = async () => {
    if (!validate()) return false;
    setBusy("save");
    try {
      await call("/api/admin/branding", { method: "PUT", json: form });
      toast.success("Draft saved", { description: "The live site hasn't changed yet. Publish to apply it." });
      reload();
      return true;
    } catch (e) {
      const m = e instanceof FetchError ? /^(\w+): (.+)$/.exec(e.message) : null;
      if (m) setErrors({ [m[1]]: m[2] });
      toast.error(e instanceof Error ? e.message : "Couldn't save the draft");
      return false;
    } finally {
      setBusy("");
    }
  };
  const act = async (action: "publish" | "discard" | "reset") => {
    setBusy(action);
    try {
      if (action === "publish" && dirty && !(await saveDraft())) return;
      setBusy(action);
      await call("/api/admin/branding", { method: "POST", json: { action } });
      toast.success(action === "publish" ? "Branding published" : action === "discard" ? "Draft discarded" : "Defaults loaded into the draft", {
        description: action === "publish" ? "Public pages show the new branding now (other open tabs after a reload)." : action === "reset" ? "Review them, then publish to apply." : undefined,
      });
      setConfirm(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy("");
    }
  };

  const status = hasDraft || dirty
    ? <Badge tone="amber">{dirty ? "Unsaved changes" : "Draft not published"}</Badge>
    : <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Live</Badge>;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {status}
          <span className="text-xs text-slate-500">{pendingChanges.length ? `${pendingChanges.length} field${pendingChanges.length === 1 ? "" : "s"} differ from the live site` : "Matches the live site"}</span>
        </div>

        <SettingsNav items={section === "identity"
          ? [["identity", "Identity"], ["seo", "Search & sharing"], ["contact", "Contact"], ["social", "Social"], ["images", "Favicon & image"]]
          : [["colours", "Colours"], ["theme", "Theme & header"], ["logos", "Logos"]]} />
        {section === "identity" ? <IdentityFields form={form} set={set} errors={errors} /> : <AppearanceFields form={form} set={set} errors={errors} />}
        <AssetFields section={section} form={form} set={set} assets={data.assets} rules={data.rules} onUploaded={reload} />

        <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-pop backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 [&_button]:h-8 [&_button]:px-3 [&_button]:text-xs">
          <Button onClick={() => (pendingChanges.length ? setConfirm("publish") : toast.info("Nothing to publish."))} loading={busy === "publish"} disabled={!!busy}>Publish</Button>
          <Button variant="outline" onClick={saveDraft} loading={busy === "save"} disabled={!dirty || !!busy}>Save draft</Button>
          <Button variant="ghost" onClick={() => setConfirm("cancel")} disabled={!dirty || !!busy}><Undo2 className="h-4 w-4" /> Cancel edits</Button>
          <div className="ml-auto flex gap-2">
            {hasDraft && <Button variant="ghost" onClick={() => setConfirm("discard")} disabled={!!busy}>Discard draft</Button>}
            <Button variant="ghost" onClick={() => setConfirm("reset")} disabled={!!busy}><RotateCcw className="h-4 w-4" /> Reset to defaults</Button>
          </div>
        </div>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        <Section title="Preview" description="How visitors will see it after publishing."
          actions={<Segmented size="sm" value={previewDark ? "dark" : "light"} onChange={(v) => setPreviewDark(v === "dark")} options={[{ value: "light", label: <span className="inline-flex items-center gap-1"><Sun className="h-3 w-3" /> Light</span> }, { value: "dark", label: <span className="inline-flex items-center gap-1"><Moon className="h-3 w-3" /> Dark</span> }]} />}>
          <BrandPreview b={form} dark={previewDark} />
        </Section>
      </aside>

      <ConfirmDialog open={confirm === "publish"} onClose={() => setConfirm(null)} tone="primary" title="Publish branding to the live site?" confirmLabel="Publish" onConfirm={() => act("publish")} loading={busy === "publish"}>
        <p>These fields change on every public and customer-facing page:</p>
        <p className="mt-2 font-mono text-xs">{pendingChanges.join(", ") || "—"}</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "discard"} onClose={() => setConfirm(null)} title="Discard the unpublished draft?" confirmLabel="Discard draft" onConfirm={() => act("discard")}>
        The editor goes back to what&apos;s live now. Uploaded images stay available for later.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "reset"} onClose={() => setConfirm(null)} title="Load the default branding?" confirmLabel="Load defaults" onConfirm={() => act("reset")}>
        The defaults replace the current draft. Nothing changes on the live site until you publish.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "cancel"} onClose={() => setConfirm(null)} title="Throw away your unsaved edits?" confirmLabel="Throw away" onConfirm={() => { setForm(saved); setErrors({}); setConfirm(null); }}>
        The form returns to the last saved version.
      </ConfirmDialog>
      {guard}
    </div>
  );
}

type SetFn = <K extends keyof Branding>(k: K, v: Branding[K]) => void;

function IdentityFields({ form, set, errors }: { form: Branding; set: SetFn; errors: Record<string, string> }) {
  const txt = (k: keyof Branding, label: string, opts: { max: number; hint?: string; area?: boolean; placeholder?: string; type?: string } = { max: 100 }) => (
    <Field label={label} htmlFor={`b-${k}`} error={errors[k]} hint={opts.hint ?? `${String(form[k] ?? "").length}/${opts.max}`}>
      {opts.area
        ? <Textarea id={`b-${k}`} rows={3} maxLength={opts.max} value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} invalid={!!errors[k]} placeholder={opts.placeholder} />
        : <Input id={`b-${k}`} type={opts.type} maxLength={opts.max} value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} invalid={!!errors[k]} placeholder={opts.placeholder} />}
    </Field>
  );
  return (
    <>
      <SettingsGroup stacked id="identity" title="Site identity">
        <div className="grid gap-4 sm:grid-cols-2">
          {txt("brandName", "Brand name", { max: 40, hint: "Shown in the header, footer and e-mails." })}
          {txt("companyName", "Company / legal name", { max: 100 })}
          <div className="sm:col-span-2">{txt("siteTitle", "Website title", { max: 70, hint: "Browser tab and search results on the homepage." })}</div>
          {txt("titleTemplate", "Browser title template", { max: 70, hint: "%s is replaced by the page name, e.g. “Pricing · QRSathi”." })}
          {txt("shortDescription", "Short description", { max: 120 })}
          <div className="sm:col-span-2">{txt("homeDescription", "Homepage description", { max: 400, area: true })}</div>
        </div>
      </SettingsGroup>
      <SettingsGroup stacked id="seo" title="Search & social sharing">
        <div className="grid gap-4">
          {txt("metaDescription", "SEO meta description", { max: 170 })}
          <div className="grid gap-4 sm:grid-cols-2">
            {txt("ogTitle", "Social title", { max: 70, hint: "Leave empty to use the website title." })}
            {txt("ogDescription", "Social description", { max: 200, hint: "Leave empty to use the meta description." })}
          </div>
        </div>
      </SettingsGroup>
      <SettingsGroup stacked id="contact" title="Contact & footer">
        <div className="grid gap-4 sm:grid-cols-2">
          {txt("supportEmail", "Support e-mail", { max: 200, type: "email", hint: "Shown on Contact, Help and legal pages. Leave empty to hide." })}
          {txt("contactPhone", "Public phone", { max: 30, placeholder: "+91 …" })}
          <div className="sm:col-span-2">{txt("contactAddress", "Public address", { max: 300, area: true })}</div>
          <div className="sm:col-span-2">{txt("footerText", "Footer copyright text", { max: 200, hint: "{year} and {company} are filled in automatically." })}</div>
        </div>
      </SettingsGroup>
      <SettingsGroup stacked id="social" title="Social profiles" description="Shown as icons in the site footer. Only filled-in links appear; each must be an https link on that network's own site.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_NETWORKS.map((n) => {
            const k = `social.${n.id}`;
            return (
              <Field key={n.id} label={<span className="inline-flex items-center gap-2"><BrandIcon brand={n.id} className="h-3.5 w-3.5" /> {n.label}</span>} htmlFor={`b-${k}`} error={errors[k]}>
                <Input id={`b-${k}`} type="url" inputMode="url" maxLength={300} placeholder={n.placeholder} value={form.social[n.id]} invalid={!!errors[k]}
                  onChange={(e) => { set("social", { ...form.social, [n.id]: e.target.value }); }} />
              </Field>
            );
          })}
        </div>
      </SettingsGroup>
    </>
  );
}

function ColorField({ k, label, form, set, error }: { k: "primaryColor" | "accentColor"; label: string; form: Branding; set: SetFn; error?: string }) {
  const v = form[k];
  const valid = /^#[0-9a-f]{6}$/i.test(v);
  const onWhite = valid ? contrastRatio(v, "#ffffff") : 0;
  return (
    <Field label={label} htmlFor={`b-${k}`} error={error}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={valid ? v : "#000000"} onChange={(e) => set(k, e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700" />
        <Input id={`b-${k}`} value={v} onChange={(e) => set(k, e.target.value.trim())} maxLength={7} className="w-32 font-mono" invalid={!!error || !valid} />
        {valid && <span className={cn("text-xs", onWhite < 3 ? "text-amber-600 dark:text-amber-400" : "text-slate-500")}>{onWhite.toFixed(1)} : 1 on white{onWhite < 3 && " — low contrast"}</span>}
      </div>
    </Field>
  );
}

function AppearanceFields({ form, set, errors }: { form: Branding; set: SetFn; errors: Record<string, string> }) {
  const lowContrast = /^#[0-9a-f]{6}$/i.test(form.primaryColor) && contrastRatio(form.primaryColor, onColor(form.primaryColor)) < 4.5;
  return (
    <>
      <SettingsGroup stacked id="colours" title="Colours" description="Used for buttons, links, focus rings and highlights. Button text switches between white and black automatically for readability.">
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField k="primaryColor" label="Primary brand colour" form={form} set={set} error={errors.primaryColor} />
          <ColorField k="accentColor" label="Secondary accent colour" form={form} set={set} error={errors.accentColor} />
        </div>
        {lowContrast && <Alert tone="warn" className="mt-4" icon={<AlertTriangle className="h-4 w-4" />}>Button text on this colour is hard to read (below 4.5 : 1). Pick a darker or lighter shade.</Alert>}
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => { set("primaryColor", BRAND_DEFAULTS.primaryColor); set("accentColor", BRAND_DEFAULTS.accentColor); }}>Use default colours</Button>
      </SettingsGroup>
      <SettingsGroup stacked id="theme" title="Theme & header">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <span className="label">Default theme for new visitors</span>
            <Segmented value={form.defaultTheme} onChange={(v) => set("defaultTheme", v)} options={[{ value: "system", label: "Follow device" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
            <p className="hint">Visitors can still switch with the theme toggle; their choice is remembered.</p>
          </div>
          <div>
            <span className="label">Header shows</span>
            <Segmented value={form.headerDisplay} onChange={(v) => set("headerDisplay", v)} options={[{ value: "logo-name", label: "Logo + name" }, { value: "logo", label: "Logo only" }, { value: "name", label: "Name only" }]} />
            {form.headerDisplay === "logo" && !form.logo && <p className="hint text-amber-600">Upload a logo below, otherwise the default mark is shown.</p>}
          </div>
        </div>
      </SettingsGroup>
    </>
  );
}

const ASSET_LABEL: Record<AssetKind, string> = { logo: "Logo (light backgrounds)", logoDark: "Logo (dark backgrounds)", favicon: "Favicon", ogImage: "Social sharing image" };

function AssetFields({ section, form, set, assets, rules, onUploaded }: { section: EditorSection; form: Branding; set: SetFn; assets: AssetRow[]; rules: Resp["rules"]; onUploaded: () => void }) {
  const kinds: AssetKind[] = section === "identity" ? ["favicon", "ogImage"] : ["logo", "logoDark"];
  return (
    <SettingsGroup stacked id={section === "identity" ? "images" : "logos"} title={section === "identity" ? "Favicon & social image" : "Logos"} description="PNG, JPEG, WebP or plain SVG. SVGs with scripts, event handlers or external references are rejected.">
      <div className="grid gap-5 sm:grid-cols-2">
        {kinds.map((k) => <AssetField key={k} kind={k} value={form[k]} onChange={(v) => set(k, v)} meta={assets.find((a) => a.storedName === form[k])} rule={rules[k]} onUploaded={onUploaded} />)}
      </div>
    </SettingsGroup>
  );
}

function AssetField({ kind, value, onChange, meta, rule, onUploaded }: { kind: AssetKind; value: string | null; onChange: (v: string | null) => void; meta?: AssetRow; rule: { maxBytes: number; hint: string }; onUploaded: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file: File) => {
    setError("");
    if (file.size > rule.maxBytes) { setError(`The file is larger than ${Math.round(rule.maxBytes / 1024)} KB.`); return; }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const res = await fetch("/api/admin/branding/assets", { method: "POST", body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Upload failed (${res.status})`);
      onChange(j.asset.storedName);
      onUploaded();
      toast.success("Image uploaded", { description: "Save or publish to use it." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  const darkBg = kind === "logoDark";
  return (
    <div>
      <span className="label">{ASSET_LABEL[kind]}</span>
      <div className={cn("grid h-28 place-items-center overflow-hidden rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700", darkBg ? "bg-zinc-900" : "checker")}>
        {value ? <img src={assetUrl(value)!} alt={`${ASSET_LABEL[kind]} preview`} className="max-h-full max-w-full object-contain" /> : <ImageUp className={cn("h-6 w-6", darkBg ? "text-zinc-500" : "text-slate-400")} aria-hidden />}
      </div>
      <p className="hint">{meta ? `${meta.width} × ${meta.height} px · ${Math.round(meta.size / 1024)} KB · ` : ""}{rule.hint}</p>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="mt-2 flex gap-2">
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-label={`Upload ${ASSET_LABEL[kind]}`} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button size="sm" variant="outline" onClick={() => ref.current?.click()} loading={busy}><Upload className="h-3.5 w-3.5" /> {value ? "Replace" : "Upload"}</Button>
        {value && <Button size="sm" variant="ghost" onClick={() => onChange(null)}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>}
      </div>
    </div>
  );
}

/** Self-contained preview: scoped CSS variables so it reflects the draft colours without touching the console. */
export function BrandPreview({ b, dark }: { b: Branding; dark: boolean }) {
  const valid = /^#[0-9a-f]{6}$/i.test(b.primaryColor) && /^#[0-9a-f]{6}$/i.test(b.accentColor);
  const vars = valid ? ({ "--brand": hexToHslTriplet(b.primaryColor), "--brand-fg": hexToHslTriplet(onColor(b.primaryColor)), "--accent": hexToHslTriplet(b.accentColor) } as React.CSSProperties) : {};
  const logo = dark ? b.logoDark || b.logo : b.logo;
  const host = (process.env.NEXT_PUBLIC_APP_URL || "https://example.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const showLogo = b.headerDisplay !== "name";
  const showName = b.headerDisplay !== "logo" || !logo;
  return (
    <div className="space-y-4" style={vars}>
      <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        {b.favicon ? <img src={assetUrl(b.favicon)!} alt="" className="h-4 w-4 rounded-sm object-contain" /> : <span className="h-4 w-4 rounded-sm bg-brand" aria-hidden />}
        <span className="truncate text-xs text-slate-600 dark:text-slate-300">{b.siteTitle}</span>
      </div>
      <div className={cn("-mt-4 overflow-hidden rounded-b-lg border border-slate-200 dark:border-slate-700", dark ? "bg-zinc-950 text-zinc-100" : "bg-[#fbfbf9] text-zinc-900")}>
        <div className={cn("flex items-center gap-2 border-b px-4 py-3", dark ? "border-zinc-800" : "border-zinc-200")}>
          {showLogo && (logo ? <img src={assetUrl(logo)!} alt="" className="h-6 max-w-[120px] object-contain" /> : <span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-[10px] font-bold text-brand-fg" aria-hidden>Q</span>)}
          {showName && <span className="text-sm font-semibold">{b.brandName}</span>}
          <span className={cn("ml-auto text-[11px]", dark ? "text-zinc-400" : "text-zinc-500")}>Features · Pricing · Help</span>
        </div>
        <div className="px-4 py-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-brand">{b.shortDescription || " "}</p>
          <p className="mt-2 font-serif text-2xl leading-tight">{b.brandName}</p>
          <p className={cn("mt-2 text-xs leading-relaxed", dark ? "text-zinc-400" : "text-zinc-600")}>{b.homeDescription}</p>
          <div className="mt-4 flex gap-2">
            <span className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg">Get started</span>
            <span className={cn("rounded-md border px-3 py-1.5 text-xs font-medium", dark ? "border-zinc-700" : "border-zinc-300")}>See pricing</span>
          </div>
          <p className="mt-3 text-[11px] text-accent">Accent colour example</p>
        </div>
        <div className={cn("flex items-center justify-between gap-3 border-t px-4 py-3 text-[11px]", dark ? "border-zinc-800 text-zinc-500" : "border-zinc-200 text-zinc-500")}>
          <span className="min-w-0 truncate">{footerLine(b)}</span>
          {socialLinks(b).length > 0 && (
            <span className="flex shrink-0 gap-1.5" aria-label="Social links">
              {socialLinks(b).map((l) => <BrandIcon key={l.id} brand={l.id} mono className="h-3.5 w-3.5" title={l.label} />)}
            </span>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        {b.ogImage ? <img src={assetUrl(b.ogImage)!} alt="" className="aspect-[1.91/1] w-full object-cover" /> : <div className="grid aspect-[1.91/1] place-items-center bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">No social image</div>}
        <div className="space-y-0.5 bg-white p-3 dark:bg-slate-900">
          <p className="text-[11px] uppercase text-slate-500">{host}</p>
          <p className="truncate text-sm font-semibold">{b.ogTitle || b.siteTitle}</p>
          <p className="line-clamp-2 text-xs text-slate-500">{b.ogDescription || b.metaDescription || b.shortDescription}</p>
        </div>
      </div>
    </div>
  );
}
