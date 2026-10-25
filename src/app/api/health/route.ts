import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/system-status";

/**
 * Public liveness/readiness probe for load balancers and uptime monitors.
 * Reveals nothing beyond "ok"/"degraded" (no versions, hosts or errors).
 */
export async function GET() {
  const db = await checkDatabase();
  return NextResponse.json({ status: db.ok ? "ok" : "degraded" }, { status: db.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
