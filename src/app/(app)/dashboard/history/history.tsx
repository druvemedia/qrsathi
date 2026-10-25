"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { formatDate } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";

interface Item { id: string; name: string; format: string; createdAt: string; qr: { id: string; name: string } | null }

export function DownloadHistory() {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => { api<{ items: Item[] }>("/api/downloads").then((r) => setItems(r.items)).catch((e) => toast.error(e.message)); }, []);
  const clear = async () => {
    await api("/api/downloads", { method: "DELETE" });
    setItems([]);
    toast.success("History cleared");
  };
  if (!items) return <Skeleton className="h-64" />;
  if (!items.length) return <EmptyState icon={<History className="h-6 w-6" />} title="No downloads yet">Downloads you make while signed in are listed here.</EmptyState>;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <p className="text-sm text-slate-500">{items.length} most recent downloads</p>
        <Button variant="ghost" size="sm" onClick={clear}><Trash2 className="h-4 w-4" /> Clear history</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
            <tr><th className="px-4 py-2.5">File</th><th className="px-4 py-2.5">Format</th><th className="px-4 py-2.5">QR code</th><th className="px-4 py-2.5">When</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5 font-medium">{d.name}</td>
                <td className="px-4 py-2.5"><Badge>{d.format.toUpperCase()}</Badge></td>
                <td className="px-4 py-2.5">{d.qr ? <Link href={`/generator?id=${d.qr.id}`} className="text-brand hover:underline">{d.qr.name}</Link> : <span className="text-slate-400">Unsaved</span>}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatDate(d.createdAt, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
