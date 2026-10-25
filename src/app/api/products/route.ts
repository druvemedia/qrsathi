import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { createProduct, serializeProduct } from "@/lib/products";
import { logEvent } from "@/lib/log";

export const GET = handle(async (req) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const category = sp.get("category");
  const status = sp.get("status") || "active";
  const where: Prisma.ProductWhereInput = {
    userId: user.id,
    ...(status !== "all" ? { status } : {}),
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } }, { sku: { contains: q } }, { category: { contains: q } }, { brand: { contains: q } },
            { productCode: { contains: q } }, { barcodes: { some: { value: { contains: q } } } },
          ],
        }
      : {}),
  };
  const [rows, categories] = await Promise.all([
    db.product.findMany({ where, orderBy: { updatedAt: "desc" }, take: Math.min(5000, Number(sp.get("take")) || 1000), include: { barcodes: true } }),
    db.product.findMany({ where: { userId: user.id, category: { not: "" } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
  ]);
  let items = rows.map(serializeProduct);
  if (sp.get("lowStock") === "1") items = items.filter((p) => p.lowStock);
  return json({ items, categories: categories.map((c) => c.category) });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const p = await createProduct(user, body);
  await logEvent("info", "product.created", `${p.sku} ${p.name}`, user.id);
  return json({ item: serializeProduct(p) }, 201);
});
