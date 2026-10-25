import { db } from "@/lib/db";
import { baseUrl, handle, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { createQr, createSchema, serializeQr } from "@/lib/qr-service";
import { logEvent } from "@/lib/log";

export const GET = handle(async (req) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const type = sp.get("type");
  const kind = sp.get("kind"); // dynamic | static | hosted
  const favorites = sp.get("favorites") === "1";
  const sort = sp.get("sort") === "name" ? { name: "asc" as const } : { updatedAt: "desc" as const };
  const rows = await db.qrCode.findMany({
    where: {
      userId: user.id,
      ...(q ? { OR: [{ name: { contains: q } }, { campaign: { contains: q } }, { shortCode: { contains: q } }] } : {}),
      ...(type ? { type } : {}),
      ...(kind === "dynamic" ? { isDynamic: true, isHosted: false } : kind === "static" ? { isDynamic: false } : kind === "hosted" ? { isHosted: true } : {}),
      ...(favorites ? { favorite: true } : {}),
    },
    orderBy: sort,
    take: 500,
    include: { _count: { select: { scans: true } } },
  });
  return json({ items: rows.map(serializeQr) });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  await rateLimit(`qr-create:${user.id}`, 300, 60 * 60 * 1000);
  const input = await readJson(req, createSchema);
  const qr = await createQr(user, input, baseUrl(req));
  await logEvent("info", "qr.created", `${qr.type}${qr.isDynamic ? " (dynamic)" : ""} ${qr.shortCode ?? ""}`, user.id);
  return json({ item: serializeQr(qr) }, 201);
});
