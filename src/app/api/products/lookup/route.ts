import { ApiError, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { lookupProduct, serializeProduct } from "@/lib/products";

/** Read-only barcode/SKU lookup used by the scanner. Never changes stock. */
export const GET = handle(async (req) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const code = sp.get("code")?.trim();
  if (!code || code.length > 2000) throw new ApiError(400, "Missing code.");
  const hit = await lookupProduct(user.id, code, sp.get("format") || undefined);
  return json(hit ? { found: true, matchedBy: hit.matchedBy, item: serializeProduct(hit.product) } : { found: false });
});
