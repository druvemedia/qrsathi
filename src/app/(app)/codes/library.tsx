"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Copy, CopyPlus, Download, FlaskConical, Heart, MoreHorizontal, Pencil, PencilLine, Plus, QrCode, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { QrDto } from "@/lib/qr-service";
import { QR_TYPES, getType } from "@/lib/qr-types";
import { renderQr } from "@/lib/qr-render";
import { downloadBlob, exportSvg } from "@/lib/qr-export";
import { api } from "@/lib/fetcher";
import { formatDate, formatNumber, safeFilename, cn } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Input, LinkButton, Modal, Segmented, Select, Skeleton, StatCard } from "@/components/ui";
import { QrThumb } from "@/components/qr/preview";
import { trackDownload } from "@/components/qr/export-panel";
import { useApp } from "@/components/providers";

interface Usage { saved: number; dynamic: number; hosted: number; downloads: number }
interface PlanInfo { name: string; limits: import("@/lib/plans").PlanLimits }

export function Library() {
  const { user } = useApp();
  const [items, setItems] = useState<QrDto[] | null>(null);
  const [usage, setUsage] = useState<{ usage: Usage; plan: PlanInfo } | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [kind, setKind] = useState<"all" | "static" | "dynamic" | "hosted" | "favorites">("all");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [rename, setRename] = useState<QrDto | null>(null);
  const [del, setDel] = useState<QrDto | null>(null);

  const load = useCallback(async () => {
    const [list, acct] = await Promise.all([api<{ items: QrDto[] }>("/api/qrcodes"), api("/api/account")]);
    setItems(list.items);
    setUsage(acct);
  }, []);
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [load]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const s = q.trim().toLowerCase();
    return items
      .filter((i) => !s || `${i.name} ${i.campaign} ${i.shortCode ?? ""}`.toLowerCase().includes(s))
      .filter((i) => !type || i.type === type)
      .filter((i) => kind === "all" || (kind === "favorites" ? i.favorite : kind === "hosted" ? i.isHosted : kind === "dynamic" ? i.isDynamic && !i.isHosted : !i.isDynamic))
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : +new Date(b.updatedAt) - +new Date(a.updatedAt)));
  }, [items, q, type, kind, sort]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const { item } = await api<{ item: QrDto }>(`/api/qrcodes/${id}`, { method: "PATCH", json: body });
    setItems((list) => list?.map((x) => (x.id === id ? { ...x, ...item, scans: x.scans } : x)) ?? null);
  };

  const duplicate = async (qr: QrDto) => {
    try {
      const { item } = await api<{ item: QrDto }>(`/api/qrcodes/${qr.id}/duplicate`, { method: "POST" });
      setItems((list) => [{ ...item, scans: 0 }, ...(list || [])]);
      toast.success("Duplicated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not duplicate");
    }
  };

  const quickDownload = async (qr: QrDto) => {
    try {
      const { svg } = renderQr(qr.payload, qr.design, { idPrefix: "dl" });
      downloadBlob(await exportSvg(svg, "png", 1024), `${safeFilename(qr.name)}.png`);
      trackDownload(user, qr.name, "png", qr.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const recent = items?.slice().sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 4) ?? [];
  const totalScans = items?.reduce((a, i) => a + (i.scans || 0), 0) ?? 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {usage ? (
          <>
            <StatCard label="Saved QR codes" value={formatNumber(usage.usage.saved)} hint={`of ${formatNumber(usage.plan.limits.savedQr)} on ${usage.plan.name}`} />
            <StatCard label="Dynamic QR" value={`${usage.usage.dynamic}/${usage.plan.limits.dynamic}`} hint="Editable short links" />
            <StatCard label="Hosted pages" value={`${usage.usage.hosted}/${usage.plan.limits.hosted}`} hint="Menus, link-in-bio, coupons…" />
            <StatCard label="Total scans" value={formatNumber(totalScans)} hint={<Link className="text-brand" href="/analytics">View analytics →</Link>} />
          </>
        ) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px]" />)}
      </div>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Recent</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recent.map((qr) => (
              <Link key={qr.id} href={`/generator?id=${qr.id}`} className="card group flex items-center gap-3 p-3 transition hover:border-brand/40">
                <QrThumb payload={qr.payload} design={qr.design} className="h-12 w-12 shrink-0" />
                <div className="min-w-0"><p className="truncate text-sm font-semibold group-hover:text-brand">{qr.name}</p><p className="text-xs text-slate-500">{formatDate(qr.updatedAt)}</p></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <h2 className="font-display text-lg font-bold">Library</h2>
          <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, campaign, code" className="py-2 pl-9" aria-label="Search library" />
            </div>
            <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto py-2" aria-label="Filter by type">
              <option value="">All types</option>
              {QR_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as any)} className="w-auto py-2" aria-label="Sort">
              <option value="recent">Recently updated</option><option value="name">Name A–Z</option>
            </Select>
          </div>
        </div>
        <Segmented className="mb-4" size="sm" value={kind} onChange={setKind} options={[
          { value: "all", label: "All" }, { value: "static", label: "Static" }, { value: "dynamic", label: "Dynamic" }, { value: "hosted", label: "Hosted pages" },
          { value: "favorites", label: <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> Favourites</span> },
        ]} />

        {!items ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<QrCode className="h-6 w-6" />} title="No saved QR codes yet" action={<LinkButton href="/generator"><Plus className="h-4 w-4" /> Create your first QR</LinkButton>}>
            Generate a QR code and hit “Save” to keep it here. Dynamic QR codes and hosted pages are saved automatically.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No QR codes match these filters.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((qr) => (
              <QrCard key={qr.id} qr={qr} onFavorite={() => patch(qr.id, { favorite: !qr.favorite }).catch((e) => toast.error(e.message))}
                onRename={() => setRename(qr)} onDuplicate={() => duplicate(qr)} onDelete={() => setDel(qr)} onDownload={() => quickDownload(qr)} />
            ))}
          </div>
        )}
      </section>

      <RenameDialog qr={rename} onClose={() => setRename(null)} onSave={async (name) => { await patch(rename!.id, { name }); toast.success("Renamed"); }} />
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete QR code?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={async () => {
          try {
            await api(`/api/qrcodes/${del!.id}`, { method: "DELETE" });
            setItems((l) => l?.filter((x) => x.id !== del!.id) ?? null);
            toast.success("Deleted");
            setDel(null);
          } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
        }}><Trash2 className="h-4 w-4" /> Delete</Button></>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          “{del?.name}” will be removed{del?.isDynamic ? <> and its short link <strong>will stop working</strong> for every printed copy. Scan history is deleted too.</> : "."} This can&apos;t be undone.
        </p>
      </Modal>
    </div>
  );
}

function QrCard({ qr, onFavorite, onRename, onDuplicate, onDelete, onDownload }: {
  qr: QrDto; onFavorite: () => void; onRename: () => void; onDuplicate: () => void; onDelete: () => void; onDownload: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const t = getType(qr.type);
  return (
    <Card className="group relative flex gap-4 p-4 transition hover:shadow-md">
      <Link href={`/generator?id=${qr.id}`} className="shrink-0 rounded-xl bg-slate-50 p-2 dark:bg-slate-800" aria-label={`Edit ${qr.name}`}>
        <QrThumb payload={qr.payload} design={qr.design} className="h-24 w-24" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/generator?id=${qr.id}`} className="truncate font-semibold hover:text-brand">{qr.name}</Link>
          <button onClick={onFavorite} aria-label={qr.favorite ? "Remove from favourites" : "Add to favourites"} aria-pressed={qr.favorite} className="shrink-0 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Heart className={cn("h-4 w-4", qr.favorite ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
          </button>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge>{t.label}</Badge>
          {qr.isHosted ? <Badge tone="violet">Hosted</Badge> : qr.isDynamic ? <Badge tone="violet">Dynamic</Badge> : <Badge tone="blue">Static</Badge>}
          {qr.status !== "active" && <Badge tone="amber">{qr.status}</Badge>}
          {qr.isDemo && <Badge tone="amber"><FlaskConical className="h-3 w-3" /> Demo</Badge>}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {qr.isDynamic ? <>{formatNumber(qr.scans || 0)} scans · </> : null}Updated {formatDate(qr.updatedAt)}
        </p>
        <div className="mt-3 flex items-center gap-1">
          <Link href={`/generator?id=${qr.id}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" title="Edit"><PencilLine className="h-4 w-4" /></Link>
          <button onClick={onDownload} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" title="Download PNG" aria-label="Download PNG"><Download className="h-4 w-4" /></button>
          {qr.isDynamic && <Link href={`/analytics/${qr.id}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" title="Analytics"><BarChart3 className="h-4 w-4" /></Link>}
          <div className="relative ml-auto">
            <button onClick={() => setMenu((m) => !m)} onBlur={() => setTimeout(() => setMenu(false), 150)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="More actions" aria-expanded={menu}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu && (
              <div className="card absolute bottom-9 right-0 z-20 w-44 origin-bottom-right animate-dropdown-in p-1 shadow-xl">
                <MenuItem icon={Pencil} onClick={onRename}>Rename</MenuItem>
                <MenuItem icon={CopyPlus} onClick={onDuplicate}>Duplicate</MenuItem>
                {qr.shortCode && <MenuItem icon={Copy} onClick={() => { navigator.clipboard.writeText(qr.payload); toast.success("Link copied"); }}>Copy short link</MenuItem>}
                <MenuItem icon={Trash2} onClick={onDelete} danger>Delete</MenuItem>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }: { icon: any; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm", danger ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" : "hover:bg-slate-100 dark:hover:bg-slate-800")}>
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function RenameDialog({ qr, onClose, onSave }: { qr: QrDto | null; onClose: () => void; onSave: (n: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (qr) setName(qr.name); }, [qr]);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await onSave(name.trim()); onClose(); } catch (e) { toast.error(e instanceof Error ? e.message : "Rename failed"); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!qr} onClose={onClose} title="Rename QR code" size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={busy}>Save</Button></>}>
      <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} aria-label="Name" />
    </Modal>
  );
}
