"use client";
/**
 * Quick-action launcher (Ctrl/⌘ K): jump to any page, run common actions,
 * and — when signed in — find products and saved QR codes by name, SKU or code.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Barcode, CornerDownLeft, FileUp, Package, PackagePlus, QrCode, ScanLine, Search, type LucideIcon } from "lucide-react";
import { NAV_ITEMS } from "./nav-config";
import { useApp } from "./providers";
import { cn } from "@/lib/utils";

interface Cmd { id: string; label: string; hint?: string; icon: LucideIcon; href: string; group: string; keywords?: string }

const ACTIONS: Cmd[] = [
  { id: "a-qr", label: "Create QR code", icon: QrCode, href: "/generator", group: "Actions", keywords: "new" },
  { id: "a-bc", label: "Create barcode", icon: Barcode, href: "/barcodes", group: "Actions", keywords: "new ean" },
  { id: "a-scan", label: "Scan a code", icon: ScanLine, href: "/scanner", group: "Actions", keywords: "camera" },
  { id: "a-prod", label: "Add product", icon: PackagePlus, href: "/products/new", group: "Actions", keywords: "new item" },
  { id: "a-imp", label: "Import products from CSV/XLSX", icon: FileUp, href: "/products?import=1", group: "Actions", keywords: "upload excel" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user } = useApp();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<Cmd[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) { setQ(""); setActive(0); setRemote([]); setTimeout(() => input.current?.focus(), 20); }
  }, [open]);

  // Search the user's products and QR codes (read-only).
  useEffect(() => {
    if (!open || !user || q.trim().length < 2) { setRemote([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const qs = encodeURIComponent(q.trim());
        const [p, c] = await Promise.all([
          fetch(`/api/products?status=all&take=5&q=${qs}`, { signal: ctrl.signal }).then((r) => r.json()),
          fetch(`/api/qrcodes?q=${qs}`, { signal: ctrl.signal }).then((r) => r.json()),
        ]);
        setRemote([
          ...(p.items || []).slice(0, 5).map((x: any) => ({ id: `p-${x.id}`, label: x.name, hint: `SKU ${x.sku} · stock ${x.stock}`, icon: Package, href: `/products/${x.id}`, group: "Products" })),
          ...(c.items || []).slice(0, 5).map((x: any) => ({ id: `c-${x.id}`, label: x.name, hint: x.shortCode || x.type, icon: QrCode, href: `/generator?id=${x.id}`, group: "QR codes" })),
        ]);
      } catch {}
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open, user]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pages: Cmd[] = NAV_ITEMS.map((n) => ({ id: n.href, label: n.label, icon: n.icon, href: n.href, group: "Go to", keywords: n.keywords }));
    const match = (c: Cmd) => !s || `${c.label} ${c.keywords || ""}`.toLowerCase().includes(s);
    return [...ACTIONS.filter(match), ...pages.filter(match), ...remote];
  }, [q, remote]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open || typeof document === "undefined") return null;
  const go = (c: Cmd) => { onClose(); router.push(c.href); };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Quick actions">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-dialog-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={user ? "Search pages, actions, products, QR codes…" : "Search pages and actions…"}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="cmd-list"
            aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active]); }
              else if (e.key === "Escape") onClose();
            }} />
          <kbd className="rounded border border-slate-200 px-1.5 text-[10px] text-slate-400 dark:border-slate-700">Esc</kbd>
        </div>
        <ul ref={list} id="cmd-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">No results for “{q}”</li>}
          {items.map((c, i) => (
            <li key={c.id} data-idx={i}>
              {(i === 0 || items[i - 1].group !== c.group) && <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-slate-400">{c.group}</p>}
              <button id={`cmd-${c.id}`} role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onClick={() => go(c)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm", i === active ? "bg-slate-100 dark:bg-slate-800" : "")}>
                <c.icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{c.label}{c.hint && <span className="ml-2 text-xs text-slate-400">{c.hint}</span>}</span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
