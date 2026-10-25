"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Download, Eye, FlaskConical, Info, ScanLine, Users } from "lucide-react";
import type { AnalyticsDto } from "@/lib/analytics";
import { api } from "@/lib/fetcher";
import { Alert, Badge, Card, EmptyState, LinkButton, Segmented, Skeleton, StatCard } from "./ui";
import { ColumnChart, RankBars, TrendChart } from "./charts";
import { useApp } from "./providers";
import { formatNumber } from "@/lib/utils";

type Grain = "day" | "week" | "month";

function aggregate(daily: AnalyticsDto["daily"], grain: Grain) {
  if (grain === "day") return daily.map((d) => ({ label: d.date, count: d.count }));
  const m = new Map<string, number>();
  for (const d of daily) {
    const date = new Date(d.date + "T00:00:00Z");
    let key: string;
    if (grain === "month") key = d.date.slice(0, 7);
    else {
      const day = (date.getUTCDay() + 6) % 7; // Monday-start weeks
      key = new Date(date.getTime() - day * 86400000).toISOString().slice(0, 10);
    }
    m.set(key, (m.get(key) || 0) + d.count);
  }
  return [...m.entries()].map(([label, count]) => ({ label, count }));
}

const fmtLabel = (grain: Grain) => (l: string) => {
  if (!l) return "";
  if (grain === "month") return new Date(l + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
  const s = new Date(l + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return grain === "week" ? `Wk of ${s}` : s;
};

export function AnalyticsView({ qrId, isUpi }: { qrId?: string; isUpi?: boolean }) {
  const { user } = useApp();
  const maxDays = user?.limits.analyticsDays ?? 30;
  const [days, setDays] = useState("30");
  const [grain, setGrain] = useState<Grain>("day");
  const [data, setData] = useState<AnalyticsDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    api<AnalyticsDto>(`/api/analytics?days=${days}${qrId ? `&qrId=${qrId}` : ""}`).then(setData).catch((e) => setError(e.message));
  }, [days, qrId]);

  const series = useMemo(() => (data ? aggregate(data.daily, grain) : []), [data, grain]);
  const exportUrl = `/api/analytics/export?days=${days}${qrId ? `&qrId=${qrId}` : ""}`;
  const ranges = [{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "365", label: "1 year" }].filter((r) => +r.value <= maxDays);

  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={days} onChange={setDays} options={ranges} />
        <Segmented value={grain} onChange={setGrain} options={[{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]} />
        <a href={exportUrl} className="ml-auto inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>

      {data?.hasDemo && (
        <Alert tone="warn" icon={<FlaskConical className="h-4 w-4" />} title="Includes demo data">
          Some scans in this view are sample data generated in demo mode. They are labelled “demo” in the CSV export.
        </Alert>
      )}
      {(isUpi || !qrId) && (
        <Alert tone="info" icon={<Info className="h-4 w-4" />}>
          <strong>Scans are not payments.</strong> A scan means someone opened the QR link — not that they paid or completed a purchase. Confirm payments only in your bank/UPI app or via a payment provider.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data ? (
          <>
            <StatCard label="Total scans" value={formatNumber(data.total)} hint={`Last ${data.range.days} days`} icon={<ScanLine className="h-4 w-4" />} />
            <StatCard label="Unique visitors" value={formatNumber(data.uniqueDaily)} hint="Approx., counted once per device per day" icon={<Users className="h-4 w-4" />} />
            <StatCard label="All-time scans" value={formatNumber(data.lifetime)} icon={<Activity className="h-4 w-4" />} />
            <StatCard label="Count-only scans" value={formatNumber(data.untracked)} hint="Do-Not-Track, GPC or tracking off" icon={<Eye className="h-4 w-4" />} />
          </>
        ) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px]" />)}
      </div>

      <Card className="p-5">
        <h2 className="font-display font-bold">Scans over time</h2>
        <p className="text-xs text-slate-500">{grain === "day" ? "Per day" : grain === "week" ? "Per week (Mon–Sun)" : "Per month"} · UTC</p>
        <div className="mt-4">{data ? <TrendChart data={series} labelFormat={fmtLabel(grain)} /> : <Skeleton className="h-[260px]" />}</div>
      </Card>

      {data && data.total === 0 ? (
        <EmptyState icon={<ScanLine className="h-6 w-6" />} title="No scans yet in this range">
          Print or share your dynamic QR code — scans show up here within seconds. Try scanning it with your phone now.
        </EmptyState>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {([["Devices", data?.devices], ["Browsers & apps", data?.browsers], ["Operating systems", data?.os], ["Countries", data?.countries]] as const).map(([title, rows]) => (
            <Card key={title} className="p-5">
              <h3 className="mb-3 font-display font-bold">{title}</h3>
              {rows ? <RankBars data={rows as any} /> : <Skeleton className="h-40" />}
              {title === "Countries" && rows && rows.length === 0 && <p className="text-xs text-slate-400">Country is only available when hosted behind a CDN that provides it (e.g. Vercel, Cloudflare).</p>}
            </Card>
          ))}
          <Card className="p-5 md:col-span-2">
            <h3 className="font-display font-bold">Time of day</h3>
            <p className="text-xs text-slate-500">Hour of scan (UTC; add 5:30 for IST)</p>
            <div className="mt-3">{data ? <ColumnChart data={data.hours} xKey="hour" yKey="count" tickFormat={(h) => `${h}:00`} /> : <Skeleton className="h-[200px]" />}</div>
          </Card>
        </div>
      )}

      {!qrId && data && (
        <Card className="overflow-hidden">
          <div className="p-5"><h3 className="font-display font-bold">By QR code</h3></div>
          {data.perQr.length === 0 ? (
            <div className="px-5 pb-6 text-sm text-slate-500">No dynamic QR codes yet. <Link href="/generator?type=dynamic" className="font-semibold text-brand">Create one</Link>.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
                  <tr><th className="px-5 py-2.5">QR code</th><th className="px-3 py-2.5">Campaign</th><th className="px-3 py-2.5">Short code</th><th className="px-5 py-2.5 text-right">Scans ({data.range.days}d)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.perQr.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-2.5"><Link href={`/analytics/${q.id}`} className="font-medium hover:text-brand">{q.name}</Link></td>
                      <td className="px-3 py-2.5">{q.campaign ? <Badge>{q.campaign}</Badge> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{q.shortCode}</td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{formatNumber(q.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {maxDays < 365 && <p className="text-center text-xs text-slate-500">Your plan keeps {maxDays} days of analytics. <LinkButton href="/pricing" variant="ghost" size="sm">See plans</LinkButton></p>}
    </div>
  );
}
