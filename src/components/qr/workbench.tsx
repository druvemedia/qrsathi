"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Check, Copy, Download, Eye, FilePlus2, Info, Palette, PencilLine, RefreshCw, Save, ScanLine, Type as TypeIcon2 } from "lucide-react";
import { toast } from "sonner";
import { QR_TYPES, buildPayload, getType, isHostedType, validateContent } from "@/lib/qr-types";
import { DEFAULT_DESIGN, mergeDesign, renderQr, type QrDesign } from "@/lib/qr-render";
import { scanTest, svgToPngBlob } from "@/lib/qr-export";
import { TEMPLATES } from "@/lib/templates";
import { loadPrefs } from "@/lib/preferences";
import { appUrl, cn } from "@/lib/utils";
import { api } from "@/lib/fetcher";
import { Alert, Badge, Button, Card, Field, Input, Modal, Segmented, Select, Spinner, Switch, Tabs } from "@/components/ui";
import { useApp } from "@/components/providers";
import { HostedPage } from "@/components/hosted-page";
import { QrPreview } from "./preview";
import { TypeForm } from "./type-form";
import { DesignPanel } from "./design-panel";
import { ExportPanel } from "./export-panel";
import { SaveDialog, type SavedQr } from "./save-dialog";
import { CodeTypeSelector } from "./code-type-selector";
import { TypeIcon } from "@/components/icon";

export const DRAFT_KEY = "qrsathi:draft:v1";
const DEFAULT_CAPTIONS = new Set(QR_TYPES.map((t) => t.caption).filter(Boolean) as string[]);

type Project = SavedQr & { type: string; content: Record<string, any>; design: Partial<QrDesign>; destination?: string | null; status?: string };

export function Workbench({ mode = "generator" }: { mode?: "generator" | "studio" }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useApp();
  const editId = sp.get("id");
  const typeParam = sp.get("type");

  const [typeId, setTypeId] = useState(typeParam && getType(typeParam).id === typeParam ? typeParam : "url");
  const [contents, setContents] = useState<Record<string, Record<string, any>>>({});
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);
  const [dynamic, setDynamic] = useState(sp.get("dynamic") === "1");
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(!!editId);
  const [tab, setTab] = useState<"content" | "design">(mode === "studio" ? "design" : "content");
  const [showErrors, setShowErrors] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [pagePreview, setPagePreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(!typeParam);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [testing, setTesting] = useState(false);

  // Load the project being edited, or the local draft.
  useEffect(() => {
    if (editId) {
      setLoading(true);
      api<{ item: Project }>(`/api/qrcodes/${editId}`)
        .then(({ item }) => {
          setProject(item);
          setTypeId(item.type);
          setContents({ [item.type]: item.content });
          setDesign(mergeDesign(item.design));
          setName(item.name);
          setDynamic(item.isDynamic);
        })
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false));
      return;
    }
    setProject(null);
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (!typeParam && d.typeId && getType(d.typeId).id === d.typeId) { setTypeId(d.typeId); setPickerOpen(false); }
        if (d.contents && typeof d.contents === "object") setContents(d.contents);
        if (d.design) setDesign(mergeDesign(d.design));
      } else {
        // First visit: apply the defaults chosen in Settings.
        const prefs = loadPrefs();
        if (!typeParam && getType(prefs.qrType).id === prefs.qrType) setTypeId(prefs.qrType);
        const tpl = TEMPLATES.find((t) => t.id === prefs.qrTemplate);
        if (tpl) setDesign(mergeDesign({ ...DEFAULT_DESIGN, ...tpl.design }));
      }
    } catch {}
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if (typeParam && getType(typeParam).id === typeParam && !editId) setTypeId(typeParam);
  }, [typeParam, editId]);

  // Persist the draft so work survives reloads and the trip through sign-in.
  useEffect(() => {
    if (!hydrated || editId) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ typeId, contents, design }));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [typeId, contents, design, hydrated, editId]);

  const type = getType(typeId);
  const content = contents[type.id] ?? type.defaults;
  const setContent = (v: Record<string, any>) => setContents((c) => ({ ...c, [type.id]: v }));
  const validation = useMemo(() => validateContent(type, content), [type, content]);
  const hosted = isHostedType(type, validation.data ?? content);
  const isDyn = hosted || !!type.forceDynamic || (dynamic && !!type.dynamicCapable);
  const base = appUrl();

  const lastGood = useRef("");
  const payload = useMemo(() => {
    if (project?.isDynamic) return project.payload;
    if (!validation.ok) return lastGood.current;
    if (isDyn) return `${base}/${hosted ? "p" : "r"}/preview`;
    return buildPayload(type, validation.data!, { hostedUrl: `${base}/p/preview` });
  }, [project, validation, isDyn, hosted, base, type]);
  useEffect(() => {
    if (validation.ok && payload) lastGood.current = payload;
  }, [validation.ok, payload]);

  const changeType = (id: string) => {
    if (project) return;
    const next = getType(id);
    setTypeId(id);
    setShowErrors(false);
    if (DEFAULT_CAPTIONS.has(design.frameText) && next.caption) setDesign((d) => ({ ...d, frameText: next.caption! }));
  };

  const displayName = name || project?.name || type.label;
  const unsaved = isDyn && !project;

  const onSave = async () => {
    if (!validation.ok) {
      setShowErrors(true);
      setTab("content");
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (!user) {
      toast.info("Sign in to save — your design is kept as a draft.");
      router.push(`/login?next=${encodeURIComponent(pathname + (typeId ? `?type=${typeId}${dynamic ? "&dynamic=1" : ""}` : ""))}`);
      return;
    }
    if (project) {
      setSaving(true);
      try {
        const { item } = await api<{ item: Project }>(`/api/qrcodes/${project.id}`, { method: "PATCH", json: { name: displayName, content: validation.data, design } });
        setProject(item);
        toast.success(project.isDynamic ? (project.isHosted ? "Page updated — live now" : "Destination updated — no reprint needed") : "Changes saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaveOpen(true);
  };

  const onSaved = (item: SavedQr) => {
    setProject({ ...item, type: type.id, content: validation.data!, design });
    setName(item.name);
    router.replace(`${pathname}?id=${item.id}`);
  };

  const exportBlock = !validation.ok
    ? "Fix the errors in the form to download."
    : unsaved
      ? user
        ? `${hosted ? "Publish the page" : "Create the dynamic QR"} first — the final code encodes your short link.`
        : "Sign in (free) to create this QR — it needs a hosted short link."
      : undefined;

  const testScan = async () => {
    setTesting(true);
    try {
      const { svg } = renderQr(payload, design, { idPrefix: "ts" });
      const r = await scanTest(svg, payload);
      if (r.ok) toast.success("Scan test passed — the code decodes to exactly your content.");
      else toast.error("Our test scanner couldn't read this design. Increase contrast, shrink the logo or use simpler modules.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan test failed");
    } finally {
      setTesting(false);
    }
  };

  /** Copies the QR image (PNG) to the clipboard; falls back to the encoded text. */
  const copyCode = async () => {
    try {
      const { svg } = renderQr(payload, design, { idPrefix: "cp" });
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": svgToPngBlob(svg, 1024) })]);
        toast.success("QR image copied — paste it into a document or chat");
        return;
      }
      throw new Error("no image clipboard");
    } catch {
      try {
        await navigator.clipboard.writeText(payload);
        toast.success("Copied the encoded content (this browser can't copy images)");
      } catch {
        toast.error("Copy isn't available in this browser.");
      }
    }
  };

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="h-8 w-8" /></div>;

  const saveLabel = project ? (project.isDynamic ? "Update" : "Save changes") : hosted ? "Publish page" : isDyn ? "Create dynamic QR" : "Save";
  const stepNo = (n: number) => <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">{n}</span>;
  const showTypeStep = mode === "generator" && !project;

  return (
    <div className="space-y-4">
      <Segmented className="flex w-full lg:hidden [&>button]:flex-1" value={mobileView} onChange={setMobileView}
        options={[{ value: "edit", label: "Edit" }, { value: "preview", label: "Preview & download" }]} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className={cn("min-w-0 space-y-4", mobileView === "preview" && "hidden lg:block")}>
          {project && (
            <Alert tone={project.isDynamic ? "success" : "info"} icon={<PencilLine className="h-4 w-4" />}
              title={<>Editing “{project.name}” {project.isDynamic && <Badge tone="green" className="ml-1">{project.isHosted ? "Hosted page" : "Dynamic"}</Badge>}</>}>
              {project.isDynamic
                ? "Changes go live instantly for everyone who scans your printed code."
                : "This is a static QR: saving changes alters the image itself, so already-printed copies keep the old content."}
              <div className="mt-2">
                <button className="inline-flex items-center gap-1 text-xs font-medium underline" onClick={() => router.push(pathname)}>
                  <FilePlus2 className="h-3.5 w-3.5" /> Start a new QR instead
                </button>
              </div>
            </Alert>
          )}

          {showTypeStep && (
            <Card>
              <div className="flex items-center gap-3 px-5 py-4">
                {stepNo(1)}
                <h2 className="section-title">Choose a code type</h2>
                {!pickerOpen && (
                  <>
                    <span className="ml-1 inline-flex min-w-0 items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium dark:bg-slate-800">
                      <TypeIcon name={type.icon} className="h-3.5 w-3.5" aria-hidden /> <span className="truncate">{type.label}</span>
                    </span>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setPickerOpen(true)}>Change</Button>
                  </>
                )}
              </div>
              {pickerOpen && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
                  <CodeTypeSelector value={type.id} onChange={(id) => { changeType(id); setPickerOpen(false); }} />
                </div>
              )}
            </Card>
          )}

          <Card>
            <div className="flex items-center gap-3 px-5 pt-4">
              {showTypeStep && stepNo(2)}
              <h2 className="section-title">{showTypeStep ? "Enter details & customise" : "Content & design"}</h2>
            </div>
            <Tabs className="mt-2 px-3" value={tab} onChange={setTab} tabs={[
              { value: "content", label: "Content", icon: <TypeIcon2 className="h-4 w-4" /> },
              { value: "design", label: "Design", icon: <Palette className="h-4 w-4" /> },
            ]} />
            <div className="p-5">
              {tab === "content" ? (
                <div className="space-y-5">
                  {(mode === "studio" || project) && (
                    <Field label="QR type">
                      <Select value={type.id} onChange={(e) => changeType(e.target.value)} disabled={!!project}>
                        {QR_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </Select>
                    </Field>
                  )}
                  {project && <Field label="Name"><Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></Field>}
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><TypeIcon name={type.icon} className="h-4 w-4" aria-hidden /></span>
                    <div>
                      <h3 className="text-sm font-semibold">{type.label}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{type.description}</p>
                    </div>
                  </div>
                  {type.id === "upi" && (
                    <Alert tone="info" icon={<Info className="h-4 w-4" />}>
                      For printable standees, payment instructions and UPI ID tools use the <Link href="/upi" className="font-medium underline">UPI Payment QR</Link> page.
                    </Alert>
                  )}
                  <TypeForm key={type.id + (project?.id || "")} type={type} value={content} onChange={setContent} errors={validation.errors} showErrors={showErrors} />

                  {hosted ? (
                    <Alert tone="info" icon={<Eye className="h-4 w-4" />} title="Hosted mobile page">
                      Scanning opens a page hosted here, at a short link. You can update it any time without reprinting.
                      <div className="mt-2"><Button size="sm" variant="outline" onClick={() => setPagePreview(true)}><Eye className="h-3.5 w-3.5" /> Preview page</Button></div>
                    </Alert>
                  ) : type.forceDynamic ? (
                    <Alert tone="info" icon={<RefreshCw className="h-4 w-4" />} title="Dynamic QR">
                      Encodes a short link on this site that redirects to your URL. Edit the destination later, pause it, and see scan analytics.
                    </Alert>
                  ) : type.dynamicCapable ? (
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                      <Switch checked={dynamic} onChange={setDynamic} disabled={!!project}
                        label={<>Dynamic QR {!user && <Badge tone="brand" className="ml-1">Free account</Badge>}</>}
                        description="Short link with editable destination and scan analytics. Static QR codes store the link directly and never change." />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Static QR — the content is stored inside the code itself. It works offline and never expires.</p>
                  )}
                </div>
              ) : (
                <DesignPanel design={design} onChange={setDesign} compact={mode === "generator"} />
              )}
            </div>
          </Card>
          <Button variant="outline" className="w-full lg:hidden" onClick={() => { setMobileView("preview"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <Eye className="h-4 w-4" /> Preview & download
          </Button>
        </div>

        <div className={cn("space-y-4 self-start lg:sticky lg:top-20", mobileView === "edit" && "hidden lg:block")}>
          <Card>
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              {showTypeStep && stepNo(3)}
              <h2 className="section-title">Preview, test & download</h2>
              <Badge tone={isDyn ? "violet" : "slate"} className="ml-auto">{hosted ? "Hosted page" : isDyn ? "Dynamic" : "Static"}</Badge>
            </div>
            <div className="p-5">
              <QrPreview payload={payload} design={design} invalid={!validation.ok && (showErrors || !lastGood.current)}
                placeholderNote={unsaved ? `Preview — the final QR encodes your own short link after you ${hosted ? "publish" : "create"} it.` : undefined} />
              {project?.isDynamic && <ShortLink url={project.payload} qrId={project.id} />}
              {unsaved ? (
                <Button className="mt-4 w-full" onClick={onSave} loading={saving}><Save className="h-4 w-4" /> {saveLabel}</Button>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" onClick={copyCode} disabled={!!exportBlock}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                  <Button variant="outline" size="sm" onClick={onSave} loading={saving} title={saveLabel}><Save className="h-3.5 w-3.5" /> {project ? "Update" : "Save"}</Button>
                  <Button variant="outline" size="sm" onClick={testScan} loading={testing} disabled={!payload}><ScanLine className="h-3.5 w-3.5" /> Test scan</Button>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <Download className="h-4 w-4 text-slate-400" aria-hidden /><h2 className="section-title">Download</h2>
            </div>
            <div className="p-5">
              <ExportPanel payload={payload} design={design} name={displayName} qrId={project?.id} disabledReason={exportBlock}
                posterDefaults={{ headline: design.frameText || "Scan me", title: displayName }} />
            </div>
          </Card>
        </div>
      </div>

      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} type={type} content={validation.data || content} design={design}
        dynamic={isDyn} hosted={hosted} defaultName={displayName} onSaved={onSaved} />

      <Modal open={pagePreview} onClose={() => setPagePreview(false)} title="Page preview" size="sm">
        <div className="mx-auto h-[560px] w-full max-w-[340px] overflow-y-auto rounded-[2rem] border-[6px] border-slate-900 bg-slate-50">
          <HostedPage type={type.id} content={validation.data || content} preview />
        </div>
      </Modal>
    </div>
  );
}

function ShortLink({ url, qrId }: { url: string; qrId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Short link</p>
      <div className="mt-1 flex items-center gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-mono text-sm text-brand">{url}</a>
        <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-lg p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Copy short link">
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
        <Link href={`/analytics/${qrId}`} className={cn("rounded-lg p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700")} aria-label="View analytics"><BarChart3 className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
