"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Check, Copy, Eye, FilePlus2, Info, Palette, PencilLine, RefreshCw, Save, Type as TypeIcon2 } from "lucide-react";
import { toast } from "sonner";
import { QR_TYPES, buildPayload, getType, isHostedType, validateContent } from "@/lib/qr-types";
import { DEFAULT_DESIGN, mergeDesign, type QrDesign } from "@/lib/qr-render";
import { appUrl, cn } from "@/lib/utils";
import { api } from "@/lib/fetcher";
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, Spinner, Switch, Tabs } from "@/components/ui";
import { useApp } from "@/components/providers";
import { HostedPage } from "@/components/hosted-page";
import { QrPreview } from "./preview";
import { TypeForm } from "./type-form";
import { DesignPanel } from "./design-panel";
import { ExportPanel } from "./export-panel";
import { SaveDialog, type SavedQr } from "./save-dialog";
import { TypePicker } from "./type-picker";

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
        if (!typeParam && d.typeId && getType(d.typeId).id === d.typeId) setTypeId(d.typeId);
        if (d.contents && typeof d.contents === "object") setContents(d.contents);
        if (d.design) setDesign(mergeDesign(d.design));
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

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="h-8 w-8" /></div>;

  const saveLabel = project ? (project.isDynamic ? "Update" : "Save changes") : hosted ? "Publish page" : isDyn ? "Create dynamic QR" : "Save to library";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        {project && (
          <Alert tone={project.isDynamic ? "success" : "info"} icon={<PencilLine className="h-4 w-4" />}
            title={<>Editing “{project.name}” {project.isDynamic && <Badge tone="green" className="ml-1">{project.isHosted ? "Hosted page" : "Dynamic"}</Badge>}</>}>
            {project.isDynamic
              ? "Changes go live instantly for everyone who scans your printed code."
              : "This is a static QR: saving changes alters the image itself, so already-printed copies keep the old content."}
            <div className="mt-2">
              <button className="inline-flex items-center gap-1 text-xs font-semibold underline" onClick={() => { router.push(pathname); }}>
                <FilePlus2 className="h-3.5 w-3.5" /> Start a new QR instead
              </button>
            </div>
          </Alert>
        )}

        {mode === "generator" && !project && (
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base font-bold">1. Choose a QR type</h2>
            <TypePicker value={type.id} onChange={changeType} />
          </Card>
        )}

        <Card>
          <Tabs className="px-3" value={tab} onChange={setTab} tabs={[
            { value: "content", label: mode === "generator" && !project ? "2. Content" : "Content", icon: <TypeIcon2 className="h-4 w-4" /> },
            { value: "design", label: mode === "generator" && !project ? "3. Design" : "Design", icon: <Palette className="h-4 w-4" /> },
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
                <div>
                  <h3 className="font-display text-lg font-bold">{type.label}</h3>
                  <p className="text-sm text-slate-500">{type.description}</p>
                </div>
                {type.id === "upi" && (
                  <Alert tone="info" icon={<Info className="h-4 w-4" />}>
                    For printable standees, payment instructions and UPI ID tools use the <Link href="/upi" className="font-semibold underline">UPI Payment QR</Link> page.
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
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
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
      </div>

      <div className="space-y-4 self-start lg:sticky lg:top-24">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Live preview</h2>
            <Badge tone={isDyn ? "violet" : "slate"}>{hosted ? "Hosted page" : isDyn ? "Dynamic" : "Static"}</Badge>
          </div>
          <QrPreview payload={payload} design={design} invalid={!validation.ok && (showErrors || !lastGood.current)}
            placeholderNote={unsaved ? `Preview — the final QR encodes your own short link after you ${hosted ? "publish" : "create"} it.` : undefined} />
          {project?.isDynamic && <ShortLink url={project.payload} qrId={project.id} />}
          <Button className="mt-4 w-full" size="lg" variant={unsaved ? "gradient" : "outline"} onClick={onSave} loading={saving}>
            <Save className="h-4 w-4" /> {saveLabel}
          </Button>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Download</h2>
          <ExportPanel payload={payload} design={design} name={displayName} qrId={project?.id} disabledReason={exportBlock}
            posterDefaults={{ headline: design.frameText || "Scan me", title: displayName }} />
        </Card>
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
