import { createHash } from "crypto";
import type { QrCode } from "@prisma/client";
import { db } from "./db";
import { parseUa } from "./ua";

/**
 * Records a scan of a dynamic QR / hosted page.
 *
 * Privacy: raw IP addresses are never stored. A salted, per-day hash lets us
 * estimate unique daily visitors. Visitors sending Do-Not-Track or Global
 * Privacy Control, and QR codes with detailed tracking off, are counted only
 * (no device, browser, country or visitor hash).
 */
export async function recordScan(qr: Pick<QrCode, "id" | "trackScans">, headers: Headers, ip: string) {
  const info = parseUa(headers.get("user-agent"));
  if (info.device === "bot") return; // link-preview fetchers etc. are not scans
  const optOut = headers.get("dnt") === "1" || headers.get("sec-gpc") === "1" || !qr.trackScans;
  const day = new Date().toISOString().slice(0, 10);
  const country = (headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || headers.get("x-country-code") || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  try {
    await db.scan.create({
      data: optOut
        ? { qrId: qr.id }
        : {
            qrId: qr.id,
            device: info.device,
            browser: info.browser,
            os: info.os,
            country: country === "XX" || country === "T1" ? "" : country,
            visitorHash: createHash("sha256")
              .update(`${process.env.AUTH_SECRET}|${ip}|${headers.get("user-agent") || ""}|${day}`)
              .digest("hex")
              .slice(0, 32),
          },
    });
  } catch (e) {
    console.error("[scan] failed to record", e);
  }
}
