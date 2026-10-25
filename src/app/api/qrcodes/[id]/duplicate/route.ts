import { baseUrl, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { duplicateQr, getOwnedQr, serializeQr } from "@/lib/qr-service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const qr = await getOwnedQr(user, (await params).id);
  const copy = await duplicateQr(user, qr, baseUrl(req));
  return json({ item: serializeQr(copy) }, 201);
});
