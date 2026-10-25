/** Parses pagination + whitelisted sorting for admin list endpoints. */
export function listParams<S extends string>(req: Request, sortable: readonly S[], defaultSort: S) {
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Math.min(10_000, Number(sp.get("page")) || 1));
  const pageSize = Math.max(5, Math.min(100, Number(sp.get("pageSize")) || 25));
  const sortRaw = sp.get("sort") as S | null;
  const sort: S = sortRaw && sortable.includes(sortRaw) ? sortRaw : defaultSort;
  const order: "asc" | "desc" = sp.get("order") === "asc" ? "asc" : "desc";
  return { sp, page, pageSize, skip: (page - 1) * pageSize, take: pageSize, sort, order, q: sp.get("q")?.trim().slice(0, 100) || "" };
}

export function paged<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function dayBuckets(days: number) {
  const m = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) m.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), 0);
  return m;
}
export function fillDays(days: number, dates: Date[]) {
  const m = dayBuckets(days);
  for (const d of dates) {
    const k = d.toISOString().slice(0, 10);
    if (m.has(k)) m.set(k, m.get(k)! + 1);
  }
  return [...m.entries()].map(([date, count]) => ({ date, count }));
}
