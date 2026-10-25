import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { systemStatus } from "@/lib/system-status";

export const GET = handle(async () => {
  await requireAdmin();
  const [status, counts] = await Promise.all([
    systemStatus(),
    Promise.all([db.user.count(), db.qrCode.count(), db.scan.count(), db.product.count(), db.barcode.count(), db.inventoryTransaction.count(), db.upload.count(), db.session.count(), db.auditLog.count()]),
  ]);
  const [users, qrCodes, scans, products, barcodes, inventoryTransactions, uploads, sessions, auditLogs] = counts;
  return json({ ...status, records: { users, qrCodes, scans, products, barcodes, inventoryTransactions, uploads, sessions, auditLogs } });
});
