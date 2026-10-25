import { handle, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { moveStock, serializeProduct, stockInput } from "@/lib/products";

type Ctx = { params: Promise<{ id: string }> };

/** Explicit stock-in / stock-out / adjustment. Scanning alone never changes stock. */
export const POST = handle<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const input = await readJson(req, stockInput);
  const { product, entry } = await moveStock(user, (await params).id, input);
  return json({ item: serializeProduct(product), entry });
});
