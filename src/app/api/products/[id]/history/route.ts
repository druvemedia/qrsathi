import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { getOwnedProduct } from "@/lib/products";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const p = await getOwnedProduct(user, (await params).id);
  const items = await db.inventoryTransaction.findMany({ where: { productId: p.id }, orderBy: { createdAt: "desc" }, take: 500 });
  return json({ items });
});
