import { db } from "@/lib/db";
import { ApiError, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { getOwnedProduct, serializeProduct, updateProduct } from "@/lib/products";
import { logEvent } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const p = await getOwnedProduct(user, (await params).id);
  return json({ item: serializeProduct(p) });
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const p = await updateProduct(user, (await params).id, body);
  return json({ item: serializeProduct(p) });
});

/** Permanent deletion is only allowed for archived products (archive first). */
export const DELETE = handle<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const p = await getOwnedProduct(user, (await params).id);
  if (p.status !== "archived") throw new ApiError(400, "Archive the product before deleting it permanently.");
  await db.product.delete({ where: { id: p.id } });
  await logEvent("info", "product.deleted", `${p.sku} ${p.name}`, user.id);
  return json({ ok: true });
});
