import { z } from "zod";
import { clientIp, handle, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { startSubscription } from "@/lib/billing";

// Only identifiers are accepted: the price, currency and provider plan are looked up on the server.
const schema = z.object({ planId: z.string().trim().min(1).max(40), interval: z.enum(["month", "year"]) });

export const POST = handle(async (req) => {
  const user = await requireUser();
  await rateLimit(`subscribe:${user.id}`, 10, 60 * 60 * 1000);
  await rateLimit(`subscribe:ip:${clientIp(req)}`, 30, 60 * 60 * 1000);
  const { planId, interval } = await readJson(req, schema, 5_000);
  const settings = await getSettings();
  return json(await startSubscription(user, planId, interval, settings.siteName));
});
