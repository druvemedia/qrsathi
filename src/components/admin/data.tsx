"use client";
/**
 * Admin-console data primitives: a fetch hook that sends expired sessions back
 * to /admin/login, and a DataTable with sorting, selection and pagination.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { api, FetchError } from "@/lib/fetcher";
import { Button, EmptyState, LoadingSkeleton, Select } from "@/components/ui";
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

export function DataTable<T extends { id: string }>({
  columns, data, loading, error, onRetry, sort, order, onSort, selectable, selected, onSelect, empty, caption,
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
}) {
  if (error)
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 px-6 py-10 text-center dark:border-rose-500/30 dark:bg-rose-500/5" role="alert">
        <AlertTriangle className="h-5 w-5 text-rose-500" aria-hidden />
        <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
        {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
      </div>
    );
  if (loading && !data) return <LoadingSkeleton rows={6} className="py-2" />;
  if (!data?.length) return <EmptyState compact icon={<Inbox className="h-5 w-5" />} title={empty?.title || "Nothing here yet"}>{empty?.body}</EmptyState>;

  const allIds = data.map((r) => r.id);
  const allOn = !!selected && allIds.every((id) => selected.has(id));
  const toggleAll = () => onSelect?.(allOn ? new Set([...selected!].filter((id) => !allIds.includes(id))) : new Set([...(selected || []), ...allIds]));
  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    onSelect?.(n);
  };

  // `relative` also contains absolutely-positioned descendants (e.g. sr-only headers) so they can't widen the page.
  return (
    <div className={cn("relative -mx-5 overflow-x-auto scrollbar-thin", loading && "opacity-60 transition-opacity")} aria-busy={loading || undefined}>
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {selectable && (
              <th scope="col" className="w-10 py-2 pl-5"><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all rows on this page" className="h-4 w-4 rounded accent-[hsl(var(--brand))]" /></th>
            )}
            {columns.map((c, i) => (
              <th key={c.key} scope="col" aria-sort={sort === c.key ? (order === "asc" ? "ascending" : "descending") : undefined}
                className={cn("whitespace-nowrap py-2 pr-4 font-medium", i === 0 && !selectable && "pl-5", c.hideSm && "hidden md:table-cell", c.className)}>
                {c.sortable && onSort ? (
                  <button type="button" onClick={() => onSort(c.key)} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                    {c.label}
                    {sort === c.key && (order === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((row) => (
            <tr key={row.id} className={cn("align-middle hover:bg-slate-50/70 dark:hover:bg-slate-800/40", selected?.has(row.id) && "bg-brand/5")}>
              {selectable && (
                <td className="py-2.5 pl-5"><input type="checkbox" checked={!!selected?.has(row.id)} onChange={() => toggle(row.id)} aria-label="Select row" className="h-4 w-4 rounded accent-[hsl(var(--brand))]" /></td>
              )}
              {columns.map((c, i) => (
                <td key={c.key} className={cn("py-2.5 pr-4", i === 0 && !selectable && "pl-5", c.hideSm && "hidden md:table-cell", c.className)}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, total, pageSize, onPage, onPageSize }: {
  page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize?: (n: number) => void;
}) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
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
