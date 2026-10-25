import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { planForUser } from "./plan-store";
import type { Plan, PlanLimits } from "./plans";

/**
 * Server-side plan enforcement. Every quota check and the insert it guards run
 * in one transaction that first bumps the user's `quotaLock` row, so concurrent
 * requests from the same account are serialised (row lock on MySQL, write lock
 * on SQLite) and can't create more than the plan allows.
 */
export type Tx = Prisma.TransactionClient;

export async function withQuota<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    // Must be the transaction's FIRST statement and a plain locking UPDATE. Prisma's
    // update() reads the row first, which on MySQL (InnoDB, REPEATABLE READ) would fix
    // the read snapshot before the lock wait, so the counts below would miss rows
    // committed by the transaction we waited for. Backticks work on SQLite and MySQL.
    const locked = await tx.$executeRaw`UPDATE \`User\` SET \`quotaLock\` = \`quotaLock\` + 1 WHERE \`id\` = ${userId}`;
    if (locked !== 1) throw new ApiError(401, "Please sign in to continue.");
    return fn(tx);
  }, { maxWait: 10_000, timeout: 20_000 });
}

const upgrade = " Upgrade your plan for more.";

export async function assertQrQuota(tx: Tx, userId: string, plan: Plan, kind: { dynamic: boolean; hosted: boolean }) {
  const l = plan.limits;
  const total = await tx.qrCode.count({ where: { userId } });
  if (total >= l.savedQr) throw new ApiError(403, `Your ${plan.name} plan allows ${l.savedQr.toLocaleString("en-IN")} saved QR codes. Delete some first.${upgrade}`);
  if (kind.hosted) {
    const n = await tx.qrCode.count({ where: { userId, isHosted: true } });
    if (n >= l.hosted) throw new ApiError(403, `Your ${plan.name} plan allows ${l.hosted.toLocaleString("en-IN")} hosted pages.${upgrade}`);
  } else if (kind.dynamic) {
    const n = await tx.qrCode.count({ where: { userId, isDynamic: true, isHosted: false } });
    if (n >= l.dynamic) throw new ApiError(403, `Your ${plan.name} plan allows ${l.dynamic.toLocaleString("en-IN")} dynamic QR codes.${upgrade}`);
  }
}

export async function assertProductQuota(tx: Tx, userId: string, plan: Plan, adding = 1) {
  const n = await tx.product.count({ where: { userId } });
  if (n + adding > plan.limits.products)
    throw new ApiError(403, `Your ${plan.name} plan allows ${plan.limits.products.toLocaleString("en-IN")} products. Archive or delete some.${upgrade}`);
}

export async function assertBarcodeQuota(tx: Tx, userId: string, plan: Plan, adding: number) {
  if (adding <= 0) return;
  const n = await tx.barcode.count({ where: { userId } });
  if (n + adding > plan.limits.barcodes)
    throw new ApiError(403, `Your ${plan.name} plan allows ${plan.limits.barcodes.toLocaleString("en-IN")} stored barcodes.${upgrade}`);
}

export async function assertStorageQuota(tx: Tx, userId: string, plan: Plan, addingBytes: number) {
  const used = (await tx.upload.aggregate({ where: { userId }, _sum: { size: true } }))._sum.size ?? 0;
  if (used + addingBytes > plan.limits.storageMb * 1024 * 1024)
    throw new ApiError(403, `Your ${plan.name} plan includes ${plan.limits.storageMb.toLocaleString("en-IN")} MB of file storage. Delete some files first.${upgrade}`);
}

type BoolFeature = { [K in keyof PlanLimits]: PlanLimits[K] extends boolean ? K : never }[keyof PlanLimits];
const FEATURE_NAMES: Record<BoolFeature, string> = {
  analyticsExport: "Analytics export", customAlias: "Custom aliases", expiry: "Expiry dates", prioritySupport: "Priority support",
};

/** Throws 403 unless the user's plan includes a feature. */
export async function requireFeature(user: { plan: string }, feature: BoolFeature) {
  const plan = await planForUser(user);
  if (!plan.limits[feature]) throw new ApiError(403, `${FEATURE_NAMES[feature]} isn't included in the ${plan.name} plan.${upgrade}`);
  return plan;
}

/** Days of analytics the user may query (0 = analytics not included). */
export async function analyticsDays(user: { plan: string }) {
  return (await planForUser(user)).limits.analyticsDays;
}
