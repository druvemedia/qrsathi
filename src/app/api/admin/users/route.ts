import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listParams, paged } from "@/lib/admin-query";

const SORTABLE = ["createdAt", "lastLoginAt", "email", "name", "plan", "role", "status"] as const;

/** Paginated user directory. Never returns password hashes, tokens or MFA secrets. */
export const GET = handle(async (req) => {
  await requireAdmin();
  const { sp, skip, take, sort, order, q, page, pageSize } = listParams(req, SORTABLE, "createdAt");
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {}),
    ...(sp.get("status") ? { status: sp.get("status")! } : {}),
    ...(sp.get("role") ? { role: sp.get("role")! } : {}),
    ...(sp.get("plan") ? { plan: sp.get("plan")! } : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where, skip, take, orderBy: { [sort]: order },
      select: {
        id: true, email: true, name: true, role: true, plan: true, planExpiresAt: true, status: true, createdAt: true, lastLoginAt: true,
        googleId: true, passwordHash: true, mfaEnabledAt: true,
        _count: { select: { qrCodes: true, products: true, sessions: true } },
      },
    }),
  ]);
  return json(paged(users.map(({ googleId, passwordHash, mfaEnabledAt, ...u }) => ({
    ...u, google: !!googleId, hasPassword: !!passwordHash, mfaEnabled: !!mfaEnabledAt,
  })), total, page, pageSize));
});
