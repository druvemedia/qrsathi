import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const GET = handle(async (req) => {
  await requireAdmin();
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status");
  const users = await db.user.findMany({
    where: {
      ...(q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, email: true, name: true, role: true, plan: true, planExpiresAt: true, status: true, createdAt: true, lastLoginAt: true,
      googleId: true, _count: { select: { qrCodes: true } },
    },
  });
  return json({ items: users.map(({ googleId, ...u }) => ({ ...u, google: !!googleId })) });
});
