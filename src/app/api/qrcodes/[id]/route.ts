import { db } from "@/lib/db";
import { baseUrl, handle, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { getOwnedQr, serializeQr, updateQr, updateSchema } from "@/lib/qr-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const qr = await getOwnedQr(user, (await params).id);
  const count = await db.scan.count({ where: { qrId: qr.id } });
  return json({ item: serializeQr({ ...qr, _count: { scans: count } }) });
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const qr = await getOwnedQr(user, (await params).id);
  const input = await readJson(req, updateSchema);
  const updated = await updateQr(user, qr, input, baseUrl(req));
  return json({ item: serializeQr(updated) });
});

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const qr = await getOwnedQr(user, (await params).id);
  await db.qrCode.delete({ where: { id: qr.id } });
  return json({ ok: true });
});
