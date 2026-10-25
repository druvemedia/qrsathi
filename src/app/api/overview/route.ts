import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";

/** Read-only summary for the Overview dashboard (real data only). */
export const GET = handle(async () => {
  const user = await requireUser();
  const uid = user.id;
  const [qrCount, barcodeCount, productCount, stock, products, recentCodes, recentProducts, activity] = await Promise.all([
    db.qrCode.count({ where: { userId: uid } }),
    db.barcode.count({ where: { userId: uid, product: { status: "active" } } }),
    db.product.count({ where: { userId: uid, status: "active" } }),
    db.product.aggregate({ where: { userId: uid, status: "active" }, _sum: { stock: true } }),
    db.product.findMany({ where: { userId: uid, status: "active" }, select: { stock: true, lowStockAt: true } }),
    db.qrCode.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, type: true, isDynamic: true, isHosted: true, createdAt: true, payload: true, design: true } }),
    db.product.findMany({ where: { userId: uid, status: "active" }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, sku: true, stock: true, lowStockAt: true, updatedAt: true } }),
    db.inventoryTransaction.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 8, include: { product: { select: { id: true, name: true } } } }),
  ]);
  return json({
    counts: {
      qrCodes: qrCount,
      barcodes: barcodeCount,
      products: productCount,
      units: stock._sum.stock ?? 0,
      lowStock: products.filter((p) => p.stock <= p.lowStockAt).length,
    },
    recentCodes: recentCodes.map((c) => ({ ...c, design: JSON.parse(c.design) })),
    recentProducts,
    activity,
  });
});
