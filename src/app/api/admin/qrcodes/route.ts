import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const GET = handle(async (req) => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status");
  const items = await db.qrCode.findMany({
    where: {
      isDynamic: true,
      ...(q ? { OR: [{ shortCode: { contains: q } }, { name: { contains: q } }, { destination: { contains: q } }, { user: { email: { contains: q } } }] } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, name: true, type: true, shortCode: true, destination: true, isHosted: true, status: true, expiresAt: true, createdAt: true,
      user: { select: { email: true, status: true } }, _count: { select: { scans: true } },
    },
  });
  return json({ items });
});
