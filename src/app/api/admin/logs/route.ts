import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const GET = handle(async (req) => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const level = sp.get("level");
  const q = sp.get("q")?.trim();
  const items = await db.log.findMany({
    where: { ...(level ? { level } : {}), ...(q ? { OR: [{ event: { contains: q } }, { message: { contains: q } }] } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return json({ items });
});
