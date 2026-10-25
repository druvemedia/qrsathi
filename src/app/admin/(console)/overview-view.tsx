"use client";
import Link from "next/link";
import { AlertOctagon, Barcode, Flag, KeyRound, Package, QrCode, ScanLine, ShieldAlert, UserPlus, Users } from "lucide-react";
import { Alert, Badge, LoadingSkeleton, Section, StatCard } from "@/components/ui";
import { ColumnChart, RankBars } from "@/components/charts";
import { fmtDateTime, fmtInr, fmtNum, useAdminData } from "@/components/admin/data";

const dayTick = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function OverviewView() {
  const { data: s, error, loading, reload } = useAdminData("/api/admin/stats");
  if (error) return <Alert tone="error" title="Couldn't load platform statistics">{error} <button onClick={reload} className="font-medium underline">Retry</button></Alert>;
  if (loading || !s) return <LoadingSkeleton rows={8} />;
  return (
    <div className="space-y-6">
      {(s.adminsNoMfa > 0 || s.openReports > 0 || s.errors24h > 0) && (
        <div className="grid gap-3 md:grid-cols-3">
          {s.adminsNoMfa > 0 && <Alert tone="warn" icon={<KeyRound className="h-4 w-4" />} title={`${s.adminsNoMfa} administrator account${s.adminsNoMfa > 1 ? "s" : ""} without 2FA`}><Link href="/admin/security" className="underline">Review on Security</Link></Alert>}
          {s.openReports > 0 && <Alert tone="warn" icon={<Flag className="h-4 w-4" />} title={`${s.openReports} open abuse report${s.openReports > 1 ? "s" : ""}`}><Link href="/admin/reports" className="underline">Review reports</Link></Alert>}
          {s.errors24h > 0 && <Alert tone="error" icon={<AlertOctagon className="h-4 w-4" />} title={`${s.errors24h} server error${s.errors24h > 1 ? "s" : ""} in 24 h`}><Link href="/admin/system" className="underline">Open system log</Link></Alert>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Users" value={fmtNum(s.users)} hint={`${fmtNum(s.active)} active · ${fmtNum(s.suspended)} suspended`} icon={<Users />} href="/admin/users" />
        <StatCard label="New users (7 d)" value={fmtNum(s.new7)} hint={`${fmtNum(s.new30)} in 30 days`} icon={<UserPlus />} />
        <StatCard label="QR codes" value={fmtNum(s.qrs)} hint={`${fmtNum(s.dynamic)} dynamic · ${fmtNum(s.hosted)} hosted`} icon={<QrCode />} href="/admin/qr-codes" />
        <StatCard label="Scans" value={fmtNum(s.scans)} hint={`${fmtNum(s.scans30)} in 30 days`} icon={<ScanLine />} href="/admin/analytics" />
        <StatCard label="Products" value={fmtNum(s.products)} icon={<Package />} href="/admin/products" />
        <StatCard label="Barcodes" value={fmtNum(s.barcodes)} icon={<Barcode />} href="/admin/products" />
        <StatCard label="Failed sign-ins (24 h)" value={fmtNum(s.failedLogins24h)} hint={`${fmtNum(s.adminLogins7d)} admin sign-ins in 7 days`} icon={<ShieldAlert />} tone={s.failedLogins24h > 20 ? "warn" : undefined} href="/admin/security" />
        <StatCard label="Revenue (verified)" value={s.billingConfigured || s.paidCount ? fmtInr(s.revenuePaise) : "—"}
          hint={s.billingConfigured ? `${fmtNum(s.paidCount)} paid payments` : "Billing not configured"} href="/admin/payments" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Sign-ups" description="New accounts per day, last 30 days">
          <ColumnChart data={s.signupsDaily} xKey="date" yKey="count" name="Sign-ups" tickFormat={dayTick} />
        </Section>
        <Section title="QR codes created" description="Per day, last 30 days">
          <ColumnChart data={s.qrDaily} xKey="date" yKey="count" name="QR codes" tickFormat={dayTick} />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Users by plan" actions={<Link href="/admin/subscriptions" className="text-xs font-medium text-brand hover:underline">Subscriptions</Link>}>
          <RankBars data={s.byPlan} name="Users" />
        </Section>
        <Section title="Recent administrator actions" actions={<Link href="/admin/security?category=admin" className="text-xs font-medium text-brand hover:underline">Full audit log</Link>}>
          {s.recentAdmin.length ? (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {s.recentAdmin.map((a: any) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0"><Badge>{a.action.replace(/^admin\./, "")}</Badge> <span className="text-slate-500">{a.actorEmail || "system"}</span></span>
                  <span className="text-xs text-slate-400">{fmtDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-center text-sm text-slate-400">No administrator actions recorded yet.</p>}
        </Section>
      </div>
    </div>
  );
}
