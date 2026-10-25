"use client";
import { useState } from "react";
import { Alert, LoadingSkeleton, Section, Segmented, StatCard } from "@/components/ui";
import { ColumnChart, RankBars } from "@/components/charts";
import { fmtNum, useAdminData } from "@/components/admin/data";

const dayTick = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const SERIES = [
  { key: "scans", label: "Scans" }, { key: "signups", label: "Sign-ups" }, { key: "qrs", label: "QR codes created" },
  { key: "downloads", label: "Downloads" }, { key: "products", label: "Products created" },
] as const;

export function AnalyticsView() {
  const [days, setDays] = useState("30");
  const { data: s, error, loading, reload } = useAdminData(`/api/admin/analytics?days=${days}`);
  return (
    <div className="space-y-6">
      <Segmented value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "365", label: "1 year" }]} />
      {error ? <Alert tone="error" title="Couldn't load analytics">{error} <button onClick={reload} className="font-medium underline">Retry</button></Alert>
        : loading || !s ? <LoadingSkeleton rows={6} /> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {SERIES.map((x) => <StatCard key={x.key} label={x.label} value={fmtNum(s.totals[x.key])} hint={`Last ${s.days} days`} />)}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {SERIES.map((x) => (
                <Section key={x.key} title={x.label} description="Per day (UTC)">
                  <ColumnChart data={s[x.key]} xKey="date" yKey="count" name={x.label} tickFormat={dayTick} />
                </Section>
              ))}
              <Section title="Scans by device"><RankBars data={s.devices} name="Scans" /></Section>
              <Section title="Most-created QR types"><RankBars data={s.types} name="QR codes" /></Section>
            </div>
          </>
        )}
    </div>
  );
}
