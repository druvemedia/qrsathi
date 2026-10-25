import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { getPlan } from "@/lib/plans";
import { BARCODE_MAP, lookupKey, validateBarcode } from "@/lib/barcodes";
import { createProduct, moveStock, updateProduct } from "@/lib/products";
import { logEvent } from "@/lib/log";

const schema = z.object({
  mode: z.enum(["skip", "update"]).default("skip"),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).min(1, "No rows to import").max(5000),
});

type Result = { row: number; sku: string; status: "created" | "updated" | "skipped" | "error"; message: string };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** Spreadsheet column → product field, for partial updates. */
const COLUMN_FIELDS: Record<string, string> = {
  name: "name", product_id: "productCode", brand: "brand", category: "category", variant: "variant", description: "description",
  manufacturer: "manufacturer", image_url: "imageUrl", price: "price", currency: "currency", low_stock_at: "lowStockAt", batch: "batch", expiry_date: "expiryDate",
};

/** Maps a spreadsheet row (snake_case headers) to product input. */
function toInput(r: Record<string, unknown>) {
  const barcode = s(r.barcode);
  const format = s(r.barcode_format).toLowerCase() || (/^\d{13}$/.test(barcode) ? "ean13" : /^\d{12}$/.test(barcode) ? "upca" : /^\d{8}$/.test(barcode) ? "ean8" : "code128");
  const source = (["internal", "assigned", "existing"].includes(s(r.barcode_source)) ? s(r.barcode_source) : "existing") as "internal" | "assigned" | "existing";
  return {
    name: s(r.name), sku: s(r.sku), productCode: s(r.product_id), brand: s(r.brand), category: s(r.category), variant: s(r.variant),
    description: s(r.description), manufacturer: s(r.manufacturer), imageUrl: s(r.image_url), price: s(r.price) || "0",
    currency: (s(r.currency) || "INR").toUpperCase(), stock: s(r.stock) || "0", lowStockAt: s(r.low_stock_at) || "5",
    batch: s(r.batch), expiryDate: s(r.expiry_date) || null,
    barcodes: barcode ? [{ format, value: barcode, source, isPrimary: true }] : [],
  };
}

export const POST = handle(async (req) => {
  const user = await requireUser();
  const { mode, rows } = await readJson(req, schema);
  const plan = getPlan(user.plan);
  if (rows.length > plan.bulkRows) throw new ApiError(403, `Your ${plan.name} plan imports up to ${plan.bulkRows.toLocaleString("en-IN")} rows at a time.`);

  const results: Result[] = [];
  const seenSku = new Map<string, number>();
  const seenCode = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const rowNo = i + 2; // header is row 1
    const input = toInput(rows[i]);
    const sku = input.sku;
    try {
      if (!input.name || !sku) throw new ApiError(400, "name and sku are required");
      const lower = sku.toLowerCase();
      if (seenSku.has(lower)) throw new ApiError(400, `Duplicate SKU in file (same as row ${seenSku.get(lower)})`);
      seenSku.set(lower, rowNo);
      const bc = input.barcodes[0];
      if (bc) {
        if (!BARCODE_MAP[bc.format]) throw new ApiError(400, `Unknown barcode_format "${bc.format}"`);
        const v = validateBarcode(bc.format, bc.value);
        if (!v.ok) throw new ApiError(400, `Barcode: ${v.error}`);
        const key = lookupKey(bc.format, v.value);
        if (seenCode.has(key)) throw new ApiError(400, `Duplicate barcode in file (same as row ${seenCode.get(key)})`);
        seenCode.set(key, rowNo);
      }

      const existing = await db.product.findUnique({ where: { userId_sku: { userId: user.id, sku } } });
      if (existing) {
        if (mode === "skip") { results.push({ row: rowNo, sku, status: "skipped", message: "SKU already exists" }); continue; }
        // Update only the columns that have a value in this row; blanks keep existing data.
        const raw = rows[i];
        const patch: Record<string, unknown> = {};
        for (const [col, field] of Object.entries(COLUMN_FIELDS)) {
          if (s(raw[col]) !== "") patch[field] = (input as Record<string, unknown>)[field];
        }
        if (input.barcodes.length) patch.barcodes = input.barcodes;
        await updateProduct(user, existing.id, patch);
        const newStock = Number(input.stock);
        if (s(raw.stock) !== "" && Number.isInteger(newStock) && newStock >= 0 && newStock !== existing.stock)
          await moveStock(user, existing.id, { type: "adjust", quantity: newStock, note: "Stock set by import", reference: "import" });
        results.push({ row: rowNo, sku, status: "updated", message: "" });
      } else {
        await createProduct(user, input, "imported");
        results.push({ row: rowNo, sku, status: "created", message: "" });
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed";
      results.push({ row: rowNo, sku, status: "error", message: msg });
      if (e instanceof ApiError && e.status === 403) break; // plan limit reached — stop
    }
  }
  const summary = {
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
  };
  await logEvent("info", "product.import", JSON.stringify(summary), user.id);
  return json({ summary, results });
});
