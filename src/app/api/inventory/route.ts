import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const GET = handle(async () => {
  const user = await requireUser();
  const products = await db.product.findMany({
    where: { userId: user.id, status: "active" },
    select: { id: true, name: true, sku: true, stock: true, lowStockAt: true, priceMinor: true, currency: true, category: true, expiryDate: true },
  });
  const since = new Date(Date.now() - 30 * 86400000);
  const [recent, archived, moves] = await Promise.all([
    db.inventoryTransaction.findMany({
      where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40,
      include: { product: { select: { id: true, name: true, sku: true } } },
    }),
    db.product.count({ where: { userId: user.id, status: "archived" } }),
    db.inventoryTransaction.findMany({ where: { userId: user.id, createdAt: { gte: since }, type: { in: ["in", "out"] } }, select: { type: true, quantity: true } }),
  ]);
  const low = products.filter((p) => p.stock <= p.lowStockAt).sort((a, b) => a.stock - b.stock);
  const valueByCurrency: Record<string, number> = {};
  for (const p of products) valueByCurrency[p.currency] = (valueByCurrency[p.currency] || 0) + p.priceMinor * Math.max(0, p.stock);
  const soon = new Date(Date.now() + 30 * 86400000);
  return json({
    totals: {
      products: products.length,
      archived,
      units: products.reduce((a, p) => a + p.stock, 0),
      lowStock: low.length,
      outOfStock: products.filter((p) => p.stock <= 0).length,
      in30: moves.filter((m) => m.type === "in").reduce((a, m) => a + m.quantity, 0),
      out30: -moves.filter((m) => m.type === "out").reduce((a, m) => a + m.quantity, 0),
    },
    valueByCurrency,
    lowStock: low.slice(0, 50),
    expiringSoon: products.filter((p) => p.expiryDate && p.expiryDate <= soon).sort((a, b) => +a.expiryDate! - +b.expiryDate!).slice(0, 20),
    recent,
  });
});
