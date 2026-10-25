"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, Download, History, ScanLine, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { KIND_LABELS, type ScanKind } from "@/lib/scan-classify";
import { clearHistory, historyToCsv, loadHistory, onHistoryChange, removeHistory, type HistoryEntry } from "@/lib/scan-history";
import { downloadBlob } from "@/lib/qr-export";
import { Badge, Button, Card, EmptyState, Input, LinkButton, Modal, Select } from "@/components/ui";

export function HistoryView() {
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | ScanKind>("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setItems(loadHistory());
    return onHistoryChange(() => setItems(loadHistory()));
  }, []);

  const shown = useMemo(() => (items || []).filter((h) => (!kind || h.kind === kind) && (!q || `${h.text} ${h.formatLabel}`.toLowerCase().includes(q.toLowerCase()))), [items, q, kind]);
  const kinds = useMemo(() => [...new Set((items || []).map((h) => h.kind))], [items]);
  const stamp = new Date().toISOString().slice(0, 10);

  if (items && items.length === 0)
    return <EmptyState icon={<History className="h-6 w-6" />} title="No scans yet" action={<LinkButton href="/scanner"><ScanLine className="h-4 w-4" /> Open scanner</LinkButton>}>Codes you scan on this device appear here, with time and format.</EmptyState>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scanned content" className="py-2 pl-9" aria-label="Search history" />
        </div>
        <Select className="w-auto py-2" value={kind} onChange={(e) => setKind(e.target.value as ScanKind | "")} aria-label="Filter by type">
          <option value="">All types</option>
          {kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </Select>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={() => downloadBlob(new Blob([historyToCsv(shown)], { type: "text/csv" }), `scan-history-${stamp}.csv`)}><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => downloadBlob(new Blob([JSON.stringify(shown.map(({ id: _id, ...h }) => ({ ...h, at: new Date(h.at).toISOString() })), null, 2)], { type: "application/json" }), `scan-history-${stamp}.json`)}><Download className="h-4 w-4" /> JSON</Button>
          <Button variant="outline" size="sm" onClick={() => downloadBlob(new Blob([shown.map((h) => h.text).join("\n")], { type: "text/plain" }), `scan-history-${stamp}.txt`)}><Download className="h-4 w-4" /> TXT</Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}><Trash2 className="h-4 w-4" /> Clear</Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Format</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Content</th><th className="px-4 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{new Date(h.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-4 py-2.5"><Badge>{h.formatLabel}</Badge></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs">{KIND_LABELS[h.kind]} <span className="text-slate-400">· {h.source}</span></td>
                  <td className="max-w-md px-4 py-2.5"><span className="line-clamp-2 break-all font-mono text-xs">{h.text}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <button onClick={() => { navigator.clipboard.writeText(h.text); toast.success("Copied"); }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Copy"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => removeHistory(h.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No scans match.</p>}
        </div>
      </Card>
      <p className="text-xs text-slate-500">Stored only in this browser (up to 500 entries). Clearing site data removes it. <Link href="/scanner" className="text-brand">Back to scanner</Link></p>
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear scan history?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button><Button variant="danger" onClick={() => { clearHistory(); setConfirmClear(false); toast.success("History cleared"); }}>Clear all</Button></>}>
        <p className="text-sm">This removes all {items?.length} scans stored on this device.</p>
      </Modal>
    </div>
  );
}
