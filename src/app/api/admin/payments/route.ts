import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const GET = handle(async () => {
  await requireAdmin();
  const items = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { email: true } } },
  });
  return json({ items });
});
