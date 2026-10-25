import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listParams, paged } from "@/lib/admin-query";

const SORTABLE = ["createdAt", "name", "status", "type"] as const;

/**
 * Moderation view of public-facing QR codes (dynamic redirects + hosted pages).
 * Static codes are private content and are only counted, never listed.
 */
export const GET = handle(async (req) => {
  await requireAdmin();
  const { sp, skip, take, sort, order, q, page, pageSize } = listParams(req, SORTABLE, "createdAt");
  const where: Prisma.QrCodeWhereInput = {
    isDynamic: true,
    ...(q ? { OR: [{ shortCode: { contains: q } }, { name: { contains: q } }, { destination: { contains: q } }, { user: { email: { contains: q } } }] } : {}),
    ...(sp.get("status") ? { status: sp.get("status")! } : {}),
    ...(sp.get("kind") === "hosted" ? { isHosted: true } : sp.get("kind") === "redirect" ? { isHosted: false } : {}),
  };
  const [total, items, staticCount] = await Promise.all([
    db.qrCode.count({ where }),
    db.qrCode.findMany({
      where, skip, take, orderBy: { [sort]: order },
      select: {
        id: true, name: true, type: true, shortCode: true, destination: true, isHosted: true, status: true, expiresAt: true, createdAt: true,
        user: { select: { email: true, status: true } }, _count: { select: { scans: true } },
      },
    }),
    db.qrCode.count({ where: { isDynamic: false } }),
  ]);
  return json({ ...paged(items, total, page, pageSize), staticCount });
});
