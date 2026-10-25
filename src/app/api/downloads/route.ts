import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const GET = handle(async () => {
  const user = await requireUser();
  const items = await db.download.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { qr: { select: { id: true, name: true } } },
  });
  return json({ items });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(
    req,
    z.object({ qrId: z.string().max(40).nullable().optional(), name: z.string().trim().min(1).max(120), format: z.string().max(20) }),
  );
  let qrId: string | null = null;
  if (body.qrId) {
    const qr = await db.qrCode.findUnique({ where: { id: body.qrId }, select: { userId: true } });
    if (qr?.userId === user.id) qrId = body.qrId;
  }
  await db.download.create({ data: { userId: user.id, qrId, name: body.name, format: body.format } });
  return json({ ok: true }, 201);
});

export const DELETE = handle(async () => {
  const user = await requireUser();
  await db.download.deleteMany({ where: { userId: user.id } });
  return json({ ok: true });
});
