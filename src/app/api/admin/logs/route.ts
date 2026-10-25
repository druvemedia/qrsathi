import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listParams, paged } from "@/lib/admin-query";

/** Application/system log (errors, warnings). Messages were redacted when written. */
export const GET = handle(async (req) => {
  await requireAdmin();
  const { sp, skip, take, page, pageSize, q } = listParams(req, ["createdAt"] as const, "createdAt");
  const where: Prisma.LogWhereInput = {
    ...(sp.get("level") ? { level: sp.get("level")! } : {}),
    ...(q ? { OR: [{ event: { contains: q } }, { message: { contains: q } }] } : {}),
  };
  const [total, items] = await Promise.all([db.log.count({ where }), db.log.findMany({ where, orderBy: { createdAt: "desc" }, skip, take })]);
  return json(paged(items, total, page, pageSize));
});
