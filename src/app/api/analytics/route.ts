import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { clampDays, computeAnalytics, scopeQrIds } from "@/lib/analytics";

export const GET = handle(async (req) => {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const ids = await scopeQrIds(user, sp.get("qrId"));
  const days = await clampDays(user, Number(sp.get("days") || 30));
  return json(await computeAnalytics(user, ids, days));
});
