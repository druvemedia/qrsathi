import { db } from "@/lib/db";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { clampDays, scopeQrIds } from "@/lib/analytics";

const csvCell = (v: string) => {
  // Guard against CSV/formula injection in spreadsheet apps.
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET = handle(async (req) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const ids = await scopeQrIds(user, sp.get("qrId"));
  const days = clampDays(user, Number(sp.get("days") || 30));
  const from = new Date(Date.now() - days * 86400000);
  const scans = await db.scan.findMany({
    where: { qrId: { in: ids }, createdAt: { gte: from } },
    include: { qr: { select: { name: true, shortCode: true, campaign: true } } },
    orderBy: { createdAt: "desc" },
    take: 100_000,
  });
  const header = ["timestamp_utc", "qr_name", "short_code", "campaign", "device", "browser", "os", "country", "demo"];
  const lines = [header.join(",")];
  for (const s of scans) {
    lines.push(
      [s.createdAt.toISOString(), s.qr.name, s.qr.shortCode || "", s.qr.campaign, s.device, s.browser, s.os, s.country, s.isDemo ? "yes" : "no"]
        .map((v) => csvCell(String(v)))
        .join(","),
    );
  }
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scans-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
