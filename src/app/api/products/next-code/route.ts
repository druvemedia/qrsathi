import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { ApiError, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { BARCODE_MAP, generateInternalNumber, lookupKey } from "@/lib/barcodes";

const INTERNAL_FORMATS = ["ean13", "ean8", "upca", "code128", "code39"];

/** Generates an internal barcode number not yet used by this user (restricted-circulation for EAN/UPC). */
export const GET = handle(async (req) => {
  const user = await requireUser();
  const format = new URL(req.url).searchParams.get("format") || "code128";
  if (!BARCODE_MAP[format]) throw new ApiError(400, "Unknown format.");
  if (!INTERNAL_FORMATS.includes(format)) throw new ApiError(400, `Internal numbers aren't generated for ${BARCODE_MAP[format].label}.`);
  for (let i = 0; i < 20; i++) {
    const value = generateInternalNumber(format, () => randomInt(0, 1_000_000) / 1_000_000);
    const [used, skuUsed] = await Promise.all([
      db.barcode.findFirst({ where: { userId: user.id, lookupKey: lookupKey(format, value) }, select: { id: true } }),
      db.product.findFirst({ where: { userId: user.id, sku: value }, select: { id: true } }),
    ]);
    if (!used && !skuUsed) return json({ value, format });
  }
  throw new ApiError(500, "Could not generate a unique number — please retry.");
});
