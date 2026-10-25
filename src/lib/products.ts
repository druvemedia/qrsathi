/** Product & inventory domain logic (server-side). */
import { z } from "zod";
import type { Prisma, User } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { getPlan } from "./plans";
import { BARCODE_MAP, PRODUCT_FORMATS, isRestrictedCirculation, lookupKey, renderBarcodeSvg, scanLookupKeys, validateBarcode } from "./barcodes";

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"] as const;

const money = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(/[,₹\s]/g, ""))
  .refine((v) => v === "" || /^\d{1,9}(\.\d{1,2})?$/.test(v), "Price must be a number with up to 2 decimals")
  .transform((v) => (v === "" ? 0 : Math.round(Number(v) * 100)));
const int = (label: string, min = 0) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const s = String(v).trim();
    if (s === "") return 0;
    if (!/^-?\d+$/.test(s)) { ctx.addIssue({ code: "custom", message: `${label} must be a whole number` }); return z.NEVER; }
    const n = Number(s);
    if (n < min || n > 1_000_000_000) { ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and 1,000,000,000` }); return z.NEVER; }
    return n;
  });
const text = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`);
const optUrl = z.string().trim().max(1000).refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Image URL must start with http(s)://");
const date = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined; // omitted → leave unchanged
    if (!v) return null; // "" / null → clear
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v);
    if (isNaN(d.getTime())) { ctx.addIssue({ code: "custom", message: "Expiry date must be YYYY-MM-DD" }); return z.NEVER; }
    return d;
  });

export const barcodeInput = z.object({
  format: z.string().refine((f) => !!BARCODE_MAP[f], "Unsupported barcode format"),
  value: z.string().trim().min(1, "Barcode value is required").max(1500),
  source: z.enum(["internal", "assigned", "existing"]).default("internal"),
  isPrimary: z.boolean().default(false),
});

/** Field schemas without defaults (shared by create and update). */
const fields = {
  name: z.string().trim().min(1, "Product name is required").max(150),
  sku: z.string().trim().min(1, "SKU is required").max(64).regex(/^[\w\-./ ]+$/, "SKU may contain letters, numbers, spaces and - _ . /"),
  productCode: text(64),
  brand: text(80),
  category: text(80),
  variant: text(80),
  description: text(2000),
  manufacturer: text(150),
  imageUrl: optUrl,
  price: money,
  currency: z.enum(CURRENCIES),
  stock: int("Stock"),
  lowStockAt: int("Low-stock level"),
  batch: text(40),
  expiryDate: date,
  barcodes: z.array(barcodeInput).max(10, "Up to 10 barcodes per product"),
};

export const productInput = z.object({
  ...fields,
  productCode: fields.productCode.default(""),
  brand: fields.brand.default(""),
  category: fields.category.default(""),
  variant: fields.variant.default(""),
  description: fields.description.default(""),
  manufacturer: fields.manufacturer.default(""),
  imageUrl: fields.imageUrl.default(""),
  price: fields.price.default(0),
  currency: fields.currency.default("INR"),
  stock: fields.stock.default(0),
  lowStockAt: fields.lowStockAt.default(5),
  batch: fields.batch.default(""),
  barcodes: fields.barcodes.default([]),
});
export type ProductInput = z.input<typeof productInput>;

// Updates must never fill in defaults for omitted fields (zod applies defaults even
// inside .partial()), so the patch schema is built from the default-free fields.
const { stock: _stock, ...patchFields } = fields;
export const productPatch = z.object(patchFields).partial().extend({ status: z.enum(["active", "archived"]).optional() });

/** Validates barcode values per symbology; returns normalised rows. */
export function normaliseBarcodes(list: z.infer<typeof barcodeInput>[]) {
  const out: { format: string; value: string; lookupKey: string; source: string; isPrimary: boolean }[] = [];
  list.forEach((b, i) => {
    const v = validateBarcode(b.format, b.value);
    if (!v.ok) throw new ApiError(400, `Barcode ${i + 1} (${BARCODE_MAP[b.format].label}): ${v.error}`);
    try {
      renderBarcodeSvg(b.format, v.value); // encoder-level rules (e.g. GS1 linting)
    } catch (e) {
      throw new ApiError(400, `Barcode ${i + 1} (${BARCODE_MAP[b.format].label}): ${(e as Error).message}`);
    }
    // An internal number in a GTIN format must stay inside restricted-circulation ranges.
    if (b.source === "internal" && BARCODE_MAP[b.format].gtinLike && !isRestrictedCirculation(b.format, v.value))
      throw new ApiError(400, `Barcode ${i + 1}: internal ${BARCODE_MAP[b.format].label} numbers must use the restricted-circulation prefix 2 (20–29). Mark it as "assigned" only if GS1 allocated it to you.`);
    if (out.some((o) => o.format === b.format && o.value === v.value)) throw new ApiError(400, `Barcode ${v.value} is listed twice`);
    out.push({ format: b.format, value: v.value, lookupKey: lookupKey(b.format, v.value), source: b.source, isPrimary: b.isPrimary });
  });
  if (out.length && !out.some((b) => b.isPrimary)) out[0].isPrimary = true;
  let seen = false;
  for (const b of out) { if (b.isPrimary && seen) b.isPrimary = false; if (b.isPrimary) seen = true; }
  return out;
}

/** Throws 409 if another product of this user already uses the SKU or one of the barcodes. */
export async function assertUnique(userId: string, sku: string, barcodes: { lookupKey: string; value: string }[], exceptProductId?: string) {
  const skuHit = await db.product.findFirst({ where: { userId, sku, ...(exceptProductId ? { id: { not: exceptProductId } } : {}) }, select: { name: true } });
  if (skuHit) throw new ApiError(409, `SKU "${sku}" is already used by “${skuHit.name}”.`);
  if (barcodes.length) {
    const hit = await db.barcode.findFirst({
      where: { userId, lookupKey: { in: barcodes.map((b) => b.lookupKey) }, ...(exceptProductId ? { productId: { not: exceptProductId } } : {}) },
      include: { product: { select: { name: true, sku: true } } },
    });
    if (hit) throw new ApiError(409, `Barcode ${hit.value} is already assigned to “${hit.product.name}” (${hit.product.sku}).`);
  }
}

export async function checkProductLimit(user: User, adding = 1) {
  const plan = getPlan(user.plan);
  const n = await db.product.count({ where: { userId: user.id } });
  if (n + adding > plan.productLimit) throw new ApiError(403, `Your ${plan.name} plan allows ${plan.productLimit.toLocaleString("en-IN")} products. Archive or delete some, or upgrade.`);
}

export async function createProduct(user: User, raw: unknown, txType: "created" | "imported" = "created") {
  const r = productInput.safeParse(raw);
  if (!r.success) throw new ApiError(400, r.error.issues[0]?.message || "Invalid product", r.error.issues);
  const p = r.data;
  const barcodes = normaliseBarcodes(p.barcodes);
  await checkProductLimit(user);
  await assertUnique(user.id, p.sku, barcodes);
  const { barcodes: _b, price, ...fields } = p;
  return db.product.create({
    data: {
      ...fields,
      priceMinor: price,
      userId: user.id,
      barcodes: { create: barcodes.map((b) => ({ ...b, userId: user.id })) },
      transactions: { create: { userId: user.id, type: txType, quantity: p.stock, balance: p.stock, note: txType === "imported" ? "Imported" : "Product created" } },
    },
    include: { barcodes: true },
  });
}

export async function getOwnedProduct(user: User, id: string) {
  const p = await db.product.findUnique({ where: { id }, include: { barcodes: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } });
  if (!p || p.userId !== user.id) throw new ApiError(404, "Product not found.");
  return p;
}

export async function updateProduct(user: User, id: string, raw: unknown) {
  const existing = await getOwnedProduct(user, id);
  const r = productPatch.safeParse(raw);
  if (!r.success) throw new ApiError(400, r.error.issues[0]?.message || "Invalid product", r.error.issues);
  const p = r.data;
  const barcodes = p.barcodes ? normaliseBarcodes(p.barcodes) : null;
  await assertUnique(user.id, p.sku ?? existing.sku, barcodes ?? [], id);
  const { barcodes: _b, price, status, ...fields } = p;
  const data: Prisma.ProductUpdateInput = { ...fields };
  if (price !== undefined) data.priceMinor = price;
  if (p.expiryDate !== undefined) data.expiryDate = p.expiryDate;
  const notes: string[] = [];
  if (status && status !== existing.status) {
    data.status = status;
    notes.push(status === "archived" ? "archived" : "restored");
  }
  return db.$transaction(async (tx) => {
    if (barcodes) {
      await tx.barcode.deleteMany({ where: { productId: id } });
      await tx.barcode.createMany({ data: barcodes.map((b) => ({ ...b, userId: user.id, productId: id })) });
    }
    const updated = await tx.product.update({ where: { id }, data, include: { barcodes: true } });
    const changed = Object.keys(fields).filter((k) => (fields as any)[k] !== undefined && String((existing as any)[k] ?? "") !== String((fields as any)[k] ?? ""));
    if (price !== undefined && price !== existing.priceMinor) changed.push("price");
    if (barcodes) changed.push("barcodes");
    if (notes.length) {
      await tx.inventoryTransaction.create({ data: { userId: user.id, productId: id, type: notes[0], balance: updated.stock, note: notes[0] === "archived" ? "Product archived" : "Product restored" } });
    } else if (changed.length) {
      await tx.inventoryTransaction.create({ data: { userId: user.id, productId: id, type: "updated", balance: updated.stock, note: `Edited: ${[...new Set(changed)].join(", ")}`.slice(0, 300) } });
    }
    return updated;
  });
}

export const stockInput = z.object({
  type: z.enum(["in", "out", "adjust"]),
  quantity: z.number().int().min(0).max(1_000_000_000),
  note: z.string().trim().max(300).default(""),
  reference: z.string().trim().max(100).default(""),
});

/**
 * Explicit stock movements only. "out" never drives stock negative;
 * "adjust" sets the counted quantity (stock-take). Runs atomically.
 */
export async function moveStock(user: User, id: string, input: z.infer<typeof stockInput>) {
  const product = await getOwnedProduct(user, id);
  if (product.status === "archived") throw new ApiError(400, "Restore this product before changing its stock.");
  if (input.type !== "adjust" && input.quantity === 0) throw new ApiError(400, "Quantity must be at least 1.");
  return db.$transaction(async (tx) => {
    let delta: number;
    if (input.type === "in") {
      delta = input.quantity;
      await tx.product.update({ where: { id }, data: { stock: { increment: delta } } });
    } else if (input.type === "out") {
      delta = -input.quantity;
      const res = await tx.product.updateMany({ where: { id, stock: { gte: input.quantity } }, data: { stock: { decrement: input.quantity } } });
      if (res.count === 0) {
        const cur = await tx.product.findUnique({ where: { id }, select: { stock: true } });
        throw new ApiError(400, `Not enough stock: ${cur?.stock ?? 0} available, ${input.quantity} requested.`);
      }
    } else {
      const cur = await tx.product.findUnique({ where: { id }, select: { stock: true } });
      delta = input.quantity - (cur?.stock ?? 0);
      await tx.product.update({ where: { id }, data: { stock: input.quantity } });
    }
    const after = await tx.product.findUniqueOrThrow({ where: { id }, include: { barcodes: true } });
    const entry = await tx.inventoryTransaction.create({
      data: { userId: user.id, productId: id, type: input.type, quantity: delta, balance: after.stock, note: input.note, reference: input.reference },
    });
    return { product: after, entry };
  });
}

/** Finds a product by scanned text (barcode in any equivalent form, or SKU). */
export async function lookupProduct(userId: string, code: string, scannerFormat?: string) {
  const keys = scanLookupKeys(code, scannerFormat);
  const bc = await db.barcode.findFirst({ where: { userId, OR: [{ lookupKey: { in: keys } }, { value: code.trim() }] }, include: { product: { include: { barcodes: true } } } });
  if (bc) return { product: bc.product, matchedBy: "barcode" as const, barcode: bc };
  const bySku = await db.product.findFirst({ where: { userId, sku: code.trim() }, include: { barcodes: true } });
  if (bySku) return { product: bySku, matchedBy: "sku" as const, barcode: null };
  return null;
}

export function serializeProduct(p: Prisma.ProductGetPayload<{ include: { barcodes: true } }>) {
  return {
    id: p.id, name: p.name, sku: p.sku, productCode: p.productCode, brand: p.brand, category: p.category, variant: p.variant,
    description: p.description, manufacturer: p.manufacturer, imageUrl: p.imageUrl,
    price: (p.priceMinor / 100).toFixed(2), priceMinor: p.priceMinor, currency: p.currency,
    stock: p.stock, lowStockAt: p.lowStockAt, lowStock: p.status === "active" && p.stock <= p.lowStockAt,
    batch: p.batch, expiryDate: p.expiryDate ? p.expiryDate.toISOString().slice(0, 10) : "",
    status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt,
    barcodes: p.barcodes
      .slice()
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((b) => ({ id: b.id, format: b.format, value: b.value, source: b.source, isPrimary: b.isPrimary })),
  };
}
export type ProductDto = ReturnType<typeof serializeProduct>;

export { PRODUCT_FORMATS };
