"use client";
/**
 * Chart primitives (Recharts). Single-series forms only: one hue for magnitude,
 * recessive grid/axes, 2px lines, rounded bar ends, hover tooltips on every mark.
 * Text uses ink tokens, never the series colour.
 */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "./providers";

function useInk() {
  const { theme } = useApp();
  const dark = theme === "dark";
  return {
    series: dark ? "#3987e5" : "#2a78d6",
    grid: dark ? "#1e293b" : "#eef2f7",
    axis: dark ? "#94a3b8" : "#64748b",
    surface: dark ? "#0f172a" : "#ffffff",
    text: dark ? "#f1f5f9" : "#0f172a",
    border: dark ? "#334155" : "#e2e8f0",
  };
}

function Tip({ active, payload, label, labelFormat }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="font-semibold text-slate-900 dark:text-slate-100">{labelFormat ? labelFormat(label) : label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="mt-0.5 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
          {p.name}: <strong className="text-slate-900 dark:text-slate-100">{Number(p.value).toLocaleString("en-IN")}</strong>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data, height = 260, labelFormat }: { data: { label: string; count: number }[]; height?: number; labelFormat?: (l: string) => string }) {
  const c = useInk();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.series} stopOpacity={0.22} />
            <stop offset="1" stopColor={c.series} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={24} tickFormatter={labelFormat} />
        <YAxis allowDecimals={false} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<Tip labelFormat={labelFormat} />} cursor={{ stroke: c.axis, strokeDasharray: "3 3" }} />
        <Area type="monotone" dataKey="count" name="Scans" stroke={c.series} strokeWidth={2} fill="url(#trendFill)" dot={false}
          activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2, fill: c.series }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RankBars({ data, height, name = "Scans" }: { data: { name: string; value: number }[]; height?: number; name?: string }) {
  const c = useInk();
  const rows = data.slice(0, 8);
  const h = height ?? Math.max(120, rows.length * 34 + 16);
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-400">No data in this range</p>;
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fill: c.text, fontSize: 12 }} tickLine={false} axisLine={false}
          tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + "…" : v[0].toUpperCase() + v.slice(1))} />
        <Tooltip content={<Tip />} cursor={{ fill: c.grid }} />
        <Bar dataKey="value" name={name} fill={c.series} radius={[0, 4, 4, 0]} isAnimationActive={false}
          label={{ position: "right", fill: c.axis, fontSize: 11, formatter: (v: any) => Number(v).toLocaleString("en-IN") }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ColumnChart({ data, height = 200, xKey, yKey, name = "Scans", tickFormat }: {
  data: Record<string, any>[]; height?: number; xKey: string; yKey: string; name?: string; tickFormat?: (v: any) => string;
}) {
  const c = useInk();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} tickFormatter={tickFormat} minTickGap={12} />
        <YAxis allowDecimals={false} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<Tip labelFormat={tickFormat} />} cursor={{ fill: c.grid }} />
        <Bar dataKey={yKey} name={name} fill={c.series} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
