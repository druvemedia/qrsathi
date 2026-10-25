"use client";
/**
 * Admin-console data primitives: a fetch hook that sends expired sessions back
 * to /admin/login, and a DataTable with sorting, selection and pagination.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, MoreHorizontal, X, type LucideIcon } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { Button, LoadingSkeleton, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

/** api() for the admin console: 401 → admin login, 403 MFA requirement → enrolment. */
export function useAdminApi() {
  const router = useRouter();
  return useCallback(async <T = any,>(url: string, init?: Parameters<typeof api>[1]): Promise<T> => {
    try {
      return await api<T>(url, init);
    } catch (e) {
      if (e instanceof FetchError && e.status === 401) router.replace(`/admin/login?next=${encodeURIComponent(location.pathname)}`);
      if (e instanceof FetchError && e.status === 403 && /two-factor/i.test(e.message)) router.replace("/admin/mfa");
      throw e;
    }
  }, [router]);
}

/** GET a JSON resource; refetches when the URL changes. */
export function useAdminData<T = any>(url: string | null) {
  const call = useAdminApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!url) return;
    let live = true;
    setLoading(true);
    setError("");
    call<T>(url, { cache: "no-store" })
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load data"))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [url, nonce, call]);
  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}

export function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export interface ListState { q: string; page: number; pageSize: number; sort: string; order: "asc" | "desc"; filters: Record<string, string> }

/** List query state → URL for a paginated admin endpoint. Search/filter changes reset to page 1. */
export function useListQuery(endpoint: string, init: Partial<ListState> = {}) {
  const [state, setState] = useState<ListState>({ q: "", page: 1, pageSize: 25, sort: "createdAt", order: "desc", filters: {}, ...init });
  const q = useDebounced(state.q);
  const url = useMemo(() => {
    const sp = new URLSearchParams({ page: String(state.page), pageSize: String(state.pageSize), sort: state.sort, order: state.order });
    if (q) sp.set("q", q);
    for (const [k, v] of Object.entries(state.filters)) if (v) sp.set(k, v);
    return `${endpoint}?${sp}`;
  }, [endpoint, state.page, state.pageSize, state.sort, state.order, state.filters, q]);
  return {
    state, url,
    setQ: (v: string) => setState((s) => ({ ...s, q: v, page: 1 })),
    setFilter: (k: string, v: string) => setState((s) => ({ ...s, filters: { ...s.filters, [k]: v }, page: 1 })),
    setPage: (page: number) => setState((s) => ({ ...s, page })),
    setPageSize: (pageSize: number) => setState((s) => ({ ...s, pageSize, page: 1 })),
    toggleSort: (key: string) => setState((s) => ({ ...s, sort: key, order: s.sort === key && s.order === "desc" ? "asc" : "desc", page: 1 })),
  };
}

export interface Column<T> {
  key: string;
  label: React.ReactNode;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  /** Hide on narrow screens. */
  hideSm?: boolean;
}

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number; pages: number }

/**
 * Page-level table layout: title + count, a toolbar on the page background, an
 * optional floating bulk bar, then the table body with its pagination footer.
 */
export function TableView({ title, count, toolbar, actions, bulk, onClearBulk, footer, children, id }: {
  title?: React.ReactNode; count?: React.ReactNode; toolbar?: React.ReactNode; actions?: React.ReactNode;
  /** Rendered as a bar when something is selected. */
  bulk?: React.ReactNode; onClearBulk?: () => void; footer?: React.ReactNode; children: React.ReactNode; id?: string;
}) {
  return (
    <section id={id} className="min-w-0">
      {(title || count || actions) && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-3">
            {title && <h2 className="font-serif text-xl font-medium">{title}</h2>}
            {count && <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{count}</span>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {toolbar && <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">{toolbar}</div>}
      {bulk && (
        <div className="mb-3 flex animate-dropdown-in flex-wrap items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-white shadow-pop dark:bg-white dark:text-slate-900" role="region" aria-label="Bulk actions">
          {bulk}
          {onClearBulk && <button type="button" onClick={onClearBulk} className="ml-auto grid h-7 w-7 place-items-center rounded-lg hover:bg-white/10 dark:hover:bg-slate-900/10" aria-label="Clear selection"><X className="h-4 w-4" /></button>}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        {children}
        {footer && <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">{footer}</div>}
      </div>
    </section>
  );
}

export interface RowMenuItem { label: string; icon?: LucideIcon; onClick?: () => void; href?: string; external?: boolean; danger?: boolean; hidden?: boolean; title?: string }

/** Compact "⋯" row menu: keyboard (↑ ↓ Esc), click-outside and focus return. */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const shown = items.filter((i) => !i.hidden);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    const els = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
  };
  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800";
  return (
    <div className="relative inline-block text-left" ref={ref} onKeyDown={onKey}>
      <button ref={btn} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={label}
        className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div id={id} role="menu" aria-label={label} className="card absolute right-0 top-9 z-30 w-52 origin-top-right animate-dropdown-in p-1.5 shadow-pop">
          {shown.map((m) => {
            const body = <>{m.icon && <m.icon className={cn("h-4 w-4", m.danger ? "" : "text-slate-400")} aria-hidden />}{m.label}</>;
            const cls = cn(item, m.danger ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10" : "hover:bg-slate-100 dark:hover:bg-slate-800");
            return m.href
              ? (m.external
                ? <a key={m.label} role="menuitem" href={m.href} target="_blank" rel="noopener noreferrer nofollow" title={m.title} className={cls} onClick={() => setOpen(false)}>{body}</a>
                : <Link key={m.label} role="menuitem" href={m.href} title={m.title} className={cls} onClick={() => setOpen(false)}>{body}</Link>)
              : <button key={m.label} role="menuitem" type="button" title={m.title} className={cls} onClick={() => { setOpen(false); m.onClick?.(); }}>{body}</button>;
          })}
        </div>
      )}
    </div>
  );
}

export function DataTable<T extends { id: string }>({
  columns, data, loading, error, onRetry, sort, order, onSort, selectable, selected, onSelect, empty, caption, rowClassName,
}: {
  columns: Column<T>[];
  data: T[] | undefined;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  sort?: string;
  order?: "asc" | "desc";
  onSort?: (key: string) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelect?: (next: Set<string>) => void;
  empty?: { title: string; body?: React.ReactNode };
  caption: string;
  rowClassName?: (row: T) => string | undefined;
}) {
  if (error)
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10"><AlertTriangle className="h-5 w-5" aria-hidden /></span>
        <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
        {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
      </div>
    );
  if (loading && !data) return <LoadingSkeleton rows={6} className="p-5" />;
  if (!data?.length)
    return (
      <div className="dot-grid flex flex-col items-center px-6 py-14 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-card ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"><Inbox className="h-5 w-5" aria-hidden /></span>
        <p className="mt-4 font-serif text-lg">{empty?.title || "Nothing here yet"}</p>
        {empty?.body && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{empty.body}</p>}
      </div>
    );

  const allIds = data.map((r) => r.id);
  const allOn = !!selected && allIds.every((id) => selected.has(id));
  const toggleAll = () => onSelect?.(allOn ? new Set([...selected!].filter((id) => !allIds.includes(id))) : new Set([...(selected || []), ...allIds]));
  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    onSelect?.(n);
  };
  const [lead, ...rest] = columns;
  const action = rest.find((c) => c.key === "actions");
  const details = rest.filter((c) => c !== action);
  const check = (id: string, label: string) => <input type="checkbox" checked={!!selected?.has(id)} onChange={() => toggle(id)} aria-label={label} className="h-4 w-4 rounded accent-[hsl(var(--brand))]" />;

  return (
    <div className={cn("relative transition-opacity", loading && "opacity-60")} aria-busy={loading || undefined}>
      {/* Desktop / tablet: table. `relative` contains sr-only headers so they can't widen the page. */}
      <div className="relative hidden overflow-x-auto scrollbar-thin md:block">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              {selectable && (
                <th scope="col" className="w-10 py-2.5 pl-5"><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all rows on this page" className="h-4 w-4 rounded accent-[hsl(var(--brand))]" /></th>
              )}
              {columns.map((c, i) => (
                <th key={c.key} scope="col" aria-sort={sort === c.key ? (order === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("whitespace-nowrap py-2.5 pr-4 font-semibold", i === 0 && !selectable && "pl-5", c.hideSm && "hidden lg:table-cell", c.className)}>
                  {c.sortable && onSort ? (
                    <button type="button" onClick={() => onSort(c.key)} className="group inline-flex items-center gap-1 uppercase hover:text-slate-900 dark:hover:text-white">
                      {c.label}
                      {sort === c.key
                        ? (order === "asc" ? <ArrowUp className="h-3 w-3 text-brand" aria-hidden /> : <ArrowDown className="h-3 w-3 text-brand" aria-hidden />)
                        : <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((row) => (
              <tr key={row.id} className={cn("align-middle transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40", selected?.has(row.id) && "bg-brand/5", rowClassName?.(row))}>
                {selectable && <td className="py-3 pl-5">{check(row.id, "Select row")}</td>}
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("py-3 pr-4", i === 0 && !selectable && "pl-5", c.hideSm && "hidden lg:table-cell", c.className)}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one stacked row per record. */}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden" aria-label={caption}>
        {selectable && (
          <li className="flex items-center gap-2 bg-slate-50/70 px-4 py-2 text-xs text-slate-500 dark:bg-slate-900/60">
            <input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all rows on this page" className="h-4 w-4 rounded accent-[hsl(var(--brand))]" /> Select all
          </li>
        )}
        {data.map((row) => (
          <li key={row.id} className={cn("px-4 py-3.5", selected?.has(row.id) && "bg-brand/5", rowClassName?.(row))}>
            <div className="flex items-start gap-3">
              {selectable && <div className="pt-0.5">{check(row.id, "Select row")}</div>}
              <div className="min-w-0 flex-1">{lead.render(row)}</div>
              {action && <div className="shrink-0">{action.render(row)}</div>}
            </div>
            {details.length > 0 && (
              <dl className={cn("mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2", selectable && "pl-7")}>
                {details.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{c.label}</dt>
                    <dd className="mt-0.5 min-w-0 text-sm [&_*]:max-w-full">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Pagination({ page, pages, total, pageSize, onPage, onPageSize, className }: {
  page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize?: (n: number) => void; className?: string;
}) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className={cn("flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400", className)}>
      <p>Showing <strong className="text-slate-800 dark:text-slate-200">{from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")}</strong> of {total.toLocaleString("en-IN")}</p>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <label className="flex items-center gap-1.5">Rows
            <Select value={String(pageSize)} onChange={(e) => onPageSize(Number(e.target.value))} className="h-8 w-20 text-xs">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </label>
        )}
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></Button>
        <span className="tabular-nums">Page {page} of {pages}</span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></Button>
      </div>
    </nav>
  );
}

export const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtNum = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-IN");
export const fmtInr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** One divided strip of headline numbers (instead of a row of separate cards). */
export function MetricStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none",
      "[&>*]:border-slate-100 dark:[&>*]:border-slate-800 [&>*:nth-child(odd)]:border-r [&>*:nth-child(n+3)]:border-t lg:[&>*]:border-t-0 lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0", className)}>
      {children}
    </dl>
  );
}

export function StripStat({ label, value, hint, icon, tone, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "warn"; href?: string }) {
  const body = (
    <>
      <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {icon && <span className={cn("text-slate-400 [&>svg]:h-3.5 [&>svg]:w-3.5", tone === "warn" && "text-amber-500")} aria-hidden>{icon}</span>}{label}
      </dt>
      <dd className={cn("mt-1 font-serif text-2xl tabular-nums tracking-tight", tone === "warn" && "text-amber-600 dark:text-amber-400")}>{value}</dd>
      {hint && <dd className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</dd>}
    </>
  );
  return href
    ? <Link href={href} className="block px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">{body}</Link>
    : <div className="px-5 py-4">{body}</div>;
}
