import { db } from "@/lib/db";
import { baseUrl, clientIp } from "@/lib/api";
import { recordScan } from "@/lib/scans";
import { withUtm } from "@/lib/qr-service";
import { escapeXml } from "@/lib/utils";

type Ctx = { params: Promise<{ code: string }> };

function statusPage(status: number, title: string, message: string, base: string, code = "") {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeXml(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a}
.c{max-width:420px;margin:24px;padding:32px;border-radius:20px;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.08);text-align:center}
h1{font-size:22px;margin:12px 0 8px}p{color:#475569;line-height:1.5}a{color:#4f46e5}.i{font-size:40px}</style></head>
<body><div class="c"><div class="i">⚠️</div><h1>${escapeXml(title)}</h1><p>${escapeXml(message)}</p>
<p style="font-size:13px"><a href="${base}/">Create your own QR code</a>${code ? ` · <a href="${base}/report?code=${encodeURIComponent(code)}">Report this QR</a>` : ""}</p></div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Dynamic QR redirect: looks up the short code, records the scan, then 302s. */
export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const base = baseUrl(req);
  const qr = await db.qrCode.findUnique({ where: { shortCode: code }, include: { user: { select: { status: true } } } });

  if (!qr || !qr.isDynamic) return statusPage(404, "QR code not found", "This QR code doesn't exist or has been deleted by its owner.", base);
  if (qr.isHosted) return Response.redirect(`${base}/p/${code}`, 302);
  if (qr.status === "disabled" || qr.user.status !== "active")
    return statusPage(410, "QR code disabled", "This QR code has been disabled.", base);
  if (qr.status === "paused") return statusPage(410, "QR code paused", "The owner has temporarily paused this QR code. Please try again later.", base, code);
  if (qr.expiresAt && qr.expiresAt < new Date())
    return statusPage(410, "QR code expired", "This QR code has expired.", base, code);
  if (!qr.destination) return statusPage(404, "No destination", "This QR code has no destination yet.", base, code);

  await recordScan(qr, req.headers, clientIp(req));
  return new Response(null, {
    status: 302,
    headers: {
      Location: withUtm(qr.destination, qr.utm),
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
