"use client";
import Link from "next/link";
import { AlertOctagon, ArrowUpRight, CheckCircle2, Flag, KeyRound } from "lucide-react";
import { Alert, Badge, LoadingSkeleton, Section } from "@/components/ui";
import { ColumnChart, RankBars } from "@/components/charts";
import { fmtDateTime, fmtInr, fmtNum, useAdminData } from "@/components/admin/data";
import { cn } from "@/lib/utils";

const dayTick = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** One line of the metrics ledger: label, value, optional context and link. */
function Metric({ label, value, hint, href, warn }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; warn?: boolean }) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block text-xs text-slate-500 dark:text-slate-400">{label}</span>
        {hint && <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>}
      </span>
      <span className={cn("flex items-center gap-1.5 text-lg font-semibold tabular-nums", warn && "text-amber-600 dark:text-amber-400")}>
        {value}
        {href && <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-slate-600 dark:text-slate-600 dark:group-hover:text-slate-300" aria-hidden />}
      </span>
    </>
  );
  const cls = "group flex items-center justify-between gap-4 px-5 py-3.5";
  return href ? <Link href={href} className={cn(cls, "transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40")}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function OverviewView() {
  const { data: s, error, loading, reload } = useAdminData("/api/admin/stats");
  if (error) return <Alert tone="error" title="Couldn't load platform statistics">{error} <button onClick={reload} className="font-medium underline">Retry</button></Alert>;
  if (loading || !s) return <LoadingSkeleton rows={8} />;
  const issues = [
    s.adminsNoMfa > 0 && { tone: "warn" as const, icon: <KeyRound className="h-4 w-4" />, text: `${s.adminsNoMfa} administrator account${s.adminsNoMfa > 1 ? "s" : ""} without 2FA`, href: "/admin/security/admins", cta: "Review" },
    s.openReports > 0 && { tone: "warn" as const, icon: <Flag className="h-4 w-4" />, text: `${s.openReports} open abuse report${s.openReports > 1 ? "s" : ""}`, href: "/admin/reports", cta: "Review" },
    s.errors24h > 0 && { tone: "error" as const, icon: <AlertOctagon className="h-4 w-4" />, text: `${s.errors24h} server error${s.errors24h > 1 ? "s" : ""} in 24 h`, href: "/admin/system", cta: "Open log" },
  ].filter(Boolean) as { tone: "warn" | "error"; icon: React.ReactNode; text: string; href: string; cta: string }[];

  return (
    <div className="space-y-6">
      {/* Attention strip */}
      {issues.length ? (
        <div className="flex flex-wrap gap-2">
          {issues.map((i) => (
            <Link key={i.href} href={i.href} className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset transition hover:-translate-y-px",
              i.tone === "error" ? "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/25" : "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-500/25")}>
              {i.icon}<span>{i.text}</span><span className="font-medium underline underline-offset-2">{i.cta}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Nothing needs attention: every admin has 2FA, no open reports, no server errors in 24 h.
        </p>
      )}

      {/* Users + ledger */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-6 px-6 pt-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Users</p>
              <Link href="/admin/users" className="mt-1 block font-serif text-5xl tabular-nums tracking-tight hover:text-brand">{fmtNum(s.users)}</Link>
            </div>
            <dl className="flex gap-6 text-sm">
              {[["Active", s.active], ["Suspended", s.suspended], ["New · 7 d", s.new7], ["New · 30 d", s.new30]].map(([l, v]) => (
                <div key={l as string}><dt className="text-[11px] text-slate-500">{l}</dt><dd className="font-semibold tabular-nums">{fmtNum(v as number)}</dd></div>
              ))}
            </dl>
          </div>
          <div className="px-3 pb-3 pt-4">
            <p className="px-3 pb-1 text-xs text-slate-500">Sign-ups per day, last 30 days</p>
            <ColumnChart data={s.signupsDaily} xKey="date" yKey="count" name="Sign-ups" tickFormat={dayTick} />
          </div>
        </section>

        <section className="card divide-y divide-slate-100 dark:divide-slate-800" aria-label="Platform metrics">
          <Metric label="QR codes" value={fmtNum(s.qrs)} hint={`${fmtNum(s.dynamic)} dynamic · ${fmtNum(s.hosted)} hosted`} href="/admin/qr-codes" />
          <Metric label="Scans" value={fmtNum(s.scans)} hint={`${fmtNum(s.scans30)} in 30 days`} href="/admin/analytics" />
          <Metric label="Products" value={fmtNum(s.products)} href="/admin/products" />
          <Metric label="Barcodes" value={fmtNum(s.barcodes)} href="/admin/barcodes" />
          <Metric label="Revenue (verified)" value={s.billingConfigured || s.paidCount ? fmtInr(s.revenuePaise) : "—"}
            hint={s.billingConfigured ? `${fmtNum(s.paidCount)} paid payments` : "Billing not configured"} href="/admin/payments" />
          <Metric label="Failed sign-ins (24 h)" value={fmtNum(s.failedLogins24h)} hint={`${fmtNum(s.adminLogins7d)} admin sign-ins in 7 days`} href="/admin/security/events" warn={s.failedLogins24h > 20} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="QR codes created" description="Per day, last 30 days" className="lg:col-span-2">
          <ColumnChart data={s.qrDaily} xKey="date" yKey="count" name="QR codes" tickFormat={dayTick} />
        </Section>
        <Section title="Users by plan" actions={<Link href="/admin/subscriptions" className="text-xs font-medium text-brand hover:underline">Subscriptions</Link>}>
          <RankBars data={s.byPlan} name="Users" />
        </Section>
      </div>

      <Section title="Recent administrator actions" actions={<Link href="/admin/security?category=admin" className="text-xs font-medium text-brand hover:underline">Full audit log</Link>}>
        {s.recentAdmin.length ? (
          <ol className="relative space-y-3 border-l border-slate-200 pl-5 text-sm dark:border-slate-800">
            {s.recentAdmin.map((a: any) => (
              <li key={a.id} className="relative flex flex-wrap items-center justify-between gap-2">
                <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-amber-400 ring-4 ring-white dark:ring-slate-900" aria-hidden />
                <span className="min-w-0"><Badge>{a.action.replace(/^admin\./, "")}</Badge> <span className="text-slate-500">{a.actorEmail || "system"}</span></span>
                <span className="text-xs text-slate-400">{fmtDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ol>
        ) : <p className="py-6 text-center text-sm text-slate-400">No administrator actions recorded yet.</p>}
      </Section>
    </div>
  );
}
