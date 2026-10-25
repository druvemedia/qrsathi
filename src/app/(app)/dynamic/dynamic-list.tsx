"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, Check, Copy, Download, ExternalLink, Pause, PencilLine, Play, Plus, RefreshCw, Server, X } from "lucide-react";
import { toast } from "sonner";
import type { QrDto } from "@/lib/qr-service";
import { getType } from "@/lib/qr-types";
import { renderQr } from "@/lib/qr-render";
import { downloadBlob, exportSvg } from "@/lib/qr-export";
import { api } from "@/lib/fetcher";
import { formatDate, formatNumber, safeFilename, truncate } from "@/lib/utils";
import { Alert, Badge, Button, Card, EmptyState, Input, LinkButton, Segmented, Skeleton } from "@/components/ui";
import { QrThumb } from "@/components/qr/preview";
import { trackDownload } from "@/components/qr/export-panel";
import { useApp } from "@/components/providers";

// Types whose whole content is a single URL field → editable inline.
const INLINE = new Set(["url", "dynamic", "file"]);

export function DynamicList() {
  const { user } = useApp();
  const [items, setItems] = useState<QrDto[] | null>(null);
  const [filter, setFilter] = useState<"all" | "links" | "pages">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: QrDto[] }>("/api/qrcodes").then((r) => setItems(r.items.filter((i) => i.isDynamic))).catch((e) => toast.error(e.message));
  }, []);

  const update = async (qr: QrDto, body: Record<string, unknown>, msg: string) => {
    setBusy(qr.id);
    try {
      const { item } = await api<{ item: QrDto }>(`/api/qrcodes/${qr.id}`, { method: "PATCH", json: body });
      setItems((l) => l?.map((x) => (x.id === qr.id ? { ...item, scans: x.scans } : x)) ?? null);
      toast.success(msg);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const shown = items?.filter((i) => filter === "all" || (filter === "pages" ? i.isHosted : !i.isHosted)) ?? [];
  const expired = (q: QrDto) => !!q.expiresAt && new Date(q.expiresAt) < new Date();

  return (
    <div className="space-y-6">
      <Alert tone="info" icon={<Server className="h-4 w-4" />} title="How dynamic QR codes work">
        Each code encodes a short link on this site (<code className="text-xs">/r/…</code> or <code className="text-xs">/p/…</code>). When scanned, our server records the scan and redirects to the current destination — so you can change it without reprinting. They depend on this service and domain staying online: if the server or domain goes away, printed codes stop working. Static codes don&apos;t have this dependency.
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "links", label: "Redirect links" }, { value: "pages", label: "Hosted pages" }]} />
        <LinkButton href="/generator?type=dynamic"><Plus className="h-4 w-4" /> New dynamic QR</LinkButton>
      </div>

      {!items ? <Skeleton className="h-72" /> : shown.length === 0 ? (
        <EmptyState icon={<RefreshCw className="h-6 w-6" />} title="No dynamic QR codes yet" action={<LinkButton href="/generator?type=dynamic">Create a dynamic QR</LinkButton>}>
          Dynamic QR codes let you change where a printed code points, pause it, set an expiry and see scan analytics.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {shown.map((qr) => {
            const t = getType(qr.type);
            const isEditing = editing === qr.id;
            return (
              <Card key={qr.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                <QrThumb payload={qr.payload} design={qr.design} className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/generator?id=${qr.id}`} className="font-semibold hover:text-brand">{qr.name}</Link>
                    <Badge>{t.label}</Badge>
                    {expired(qr) ? <Badge tone="rose">Expired</Badge> : qr.status === "active" ? <Badge tone="green">Active</Badge> : qr.status === "paused" ? <Badge tone="amber">Paused</Badge> : <Badge tone="rose">Disabled by admin</Badge>}
                    {qr.campaign && <Badge tone="blue">{qr.campaign}</Badge>}
                    {qr.isDemo && <Badge tone="amber">Demo</Badge>}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-brand">
                    <a href={qr.payload} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{qr.payload.replace(/^https?:\/\//, "")}</a>
                    <CopyBtn text={qr.payload} />
                  </div>
                  {isEditing ? (
                    <form className="mt-2 flex gap-2" onSubmit={async (e) => {
                      e.preventDefault();
                      if (await update(qr, { content: { ...qr.content, url: draft } }, "Destination updated — live for every printed copy")) setEditing(null);
                    }}>
                      <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="py-1.5 text-sm" autoFocus aria-label="New destination URL" />
                      <Button type="submit" size="sm" loading={busy === qr.id} aria-label="Save destination"><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
                    </form>
                  ) : (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      → {qr.isHosted ? "Hosted page" : <a href={qr.destination || "#"} target="_blank" rel="noopener noreferrer nofollow" className="truncate hover:underline">{truncate(qr.destination || "", 70)}</a>}
                      {!qr.isHosted && INLINE.has(qr.type) && (
                        <button onClick={() => { setEditing(qr.id); setDraft(qr.content.url || qr.destination || ""); }} className="rounded p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Edit destination"><PencilLine className="h-3.5 w-3.5" /></button>
                      )}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">{formatNumber(qr.scans || 0)} scans · created {formatDate(qr.createdAt)}{qr.expiresAt && ` · expires ${formatDate(qr.expiresAt, true)}`}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {qr.status !== "disabled" && (
                    <Button size="sm" variant="outline" loading={busy === qr.id && !isEditing}
                      onClick={() => update(qr, { status: qr.status === "active" ? "paused" : "active" }, qr.status === "active" ? "Paused — scans now show a paused page" : "Resumed")}>
                      {qr.status === "active" ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
                    </Button>
                  )}
                  <LinkButton size="sm" variant="outline" href={`/generator?id=${qr.id}`}><PencilLine className="h-3.5 w-3.5" /> Edit</LinkButton>
                  <LinkButton size="sm" variant="outline" href={`/analytics/${qr.id}`}><BarChart3 className="h-3.5 w-3.5" /></LinkButton>
                  <Button size="sm" variant="outline" aria-label="Download PNG" onClick={async () => {
                    const { svg } = renderQr(qr.payload, qr.design, { idPrefix: "dy" });
                    downloadBlob(await exportSvg(svg, "png", 1024), `${safeFilename(qr.name)}.png`);
                    trackDownload(user, qr.name, "png", qr.id);
                  }}><Download className="h-3.5 w-3.5" /></Button>
                  <a href={qr.payload} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 dark:border-slate-700" aria-label="Test link (counts as a scan)" title="Test link (counts as a scan)"><ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Copy short link">
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
