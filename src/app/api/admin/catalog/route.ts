import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { BARCODE_MAP } from "@/lib/barcodes";

/**
 * Platform-level product, barcode and inventory statistics. Aggregates only:
 * administrators do not browse users' private product catalogues.
 */
export const GET = handle(async () => {
  await requireAdmin();
  const d30 = new Date(Date.now() - 30 * 86400000);
  const [products, archived, barcodes, byFormat, bySource, txByType, topAccounts, accountsWithProducts] = await Promise.all([
    db.product.count({ where: { status: "active" } }),
    db.product.count({ where: { status: "archived" } }),
    db.barcode.count(),
    db.barcode.groupBy({ by: ["format"], _count: { _all: true }, orderBy: { _count: { format: "desc" } } }),
    db.barcode.groupBy({ by: ["source"], _count: { _all: true } }),
    db.inventoryTransaction.groupBy({ by: ["type"], where: { createdAt: { gte: d30 } }, _count: { _all: true } }),
    db.product.groupBy({ by: ["userId"], _count: { _all: true }, orderBy: { _count: { userId: "desc" } }, take: 10 }),
    db.product.groupBy({ by: ["userId"] }).then((r) => r.length),
  ]);
  const owners = await db.user.findMany({ where: { id: { in: topAccounts.map((t) => t.userId) } }, select: { id: true, email: true, plan: true } });
  return json({
    products, archived, barcodes, accountsWithProducts,
    byFormat: byFormat.map((b) => ({ name: BARCODE_MAP[b.format]?.label || b.format, value: b._count._all })),
    bySource: bySource.map((b) => ({ name: b.source, value: b._count._all })),
    tx30: txByType.map((t) => ({ name: t.type, value: t._count._all })),
    topAccounts: topAccounts.map((t) => ({ ...owners.find((o) => o.id === t.userId), products: t._count._all })),
  });
});
