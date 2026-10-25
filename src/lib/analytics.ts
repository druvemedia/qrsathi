import type { User } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { planForUser } from "./plan-store";

export async function scopeQrIds(user: User, qrId: string | null) {
  if (qrId) {
    const qr = await db.qrCode.findUnique({ where: { id: qrId }, select: { id: true, userId: true } });
    if (!qr || qr.userId !== user.id) throw new ApiError(404, "QR code not found.");
    return [qrId];
  }
  const rows = await db.qrCode.findMany({ where: { userId: user.id, isDynamic: true }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Clamps the requested range to the plan's analytics history; 403 if analytics aren't included. */
export async function clampDays(user: User, days: number) {
  const plan = await planForUser(user);
  const max = plan.limits.analyticsDays;
  if (max <= 0) throw new ApiError(403, `Scan analytics aren't included in the ${plan.name} plan. Upgrade your plan to see them.`);
  return Math.max(1, Math.min(Number.isFinite(days) ? days : 30, max));
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function tally(values: string[]) {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export async function computeAnalytics(user: User, qrIds: string[], days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  from.setUTCHours(0, 0, 0, 0);

  const [scans, lifetime, qrs] = await Promise.all([
    db.scan.findMany({
      where: { qrId: { in: qrIds }, createdAt: { gte: from } },
      select: { qrId: true, createdAt: true, device: true, browser: true, os: true, country: true, visitorHash: true, isDemo: true },
      orderBy: { createdAt: "asc" },
    }),
    db.scan.count({ where: { qrId: { in: qrIds } } }),
    db.qrCode.findMany({ where: { id: { in: qrIds } }, select: { id: true, name: true, shortCode: true, type: true, campaign: true, isDemo: true } }),
  ]);

  const daily = new Map<string, { count: number; visitors: Set<string> }>();
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) daily.set(dayKey(new Date(t)), { count: 0, visitors: new Set() });
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  const perQr = new Map<string, number>();
  let untracked = 0;
  for (const s of scans) {
    const k = dayKey(s.createdAt);
    const bucket = daily.get(k) ?? { count: 0, visitors: new Set<string>() };
    bucket.count++;
    if (s.visitorHash) bucket.visitors.add(s.visitorHash);
    else untracked++;
    daily.set(k, bucket);
    hours[s.createdAt.getUTCHours()].count++;
    perQr.set(s.qrId, (perQr.get(s.qrId) || 0) + 1);
  }
  const tracked = scans.filter((s) => s.visitorHash);
  const dailyArr = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, count: v.count, unique: v.visitors.size }));

  return {
    range: { from: from.toISOString(), to: to.toISOString(), days },
    total: scans.length,
    uniqueDaily: dailyArr.reduce((a, d) => a + d.unique, 0),
    untracked,
    lifetime,
    daily: dailyArr,
    hours,
    devices: tally(tracked.map((s) => s.device)),
    browsers: tally(tracked.map((s) => s.browser)),
    os: tally(tracked.map((s) => s.os)),
    countries: tally(tracked.filter((s) => s.country).map((s) => s.country)),
    perQr: qrs
      .map((q) => ({ id: q.id, name: q.name, shortCode: q.shortCode, type: q.type, campaign: q.campaign, count: perQr.get(q.id) || 0 }))
      .sort((a, b) => b.count - a.count),
    hasDemo: scans.some((s) => s.isDemo) || qrs.some((q) => q.isDemo),
  };
}
export type AnalyticsDto = Awaited<ReturnType<typeof computeAnalytics>>;
