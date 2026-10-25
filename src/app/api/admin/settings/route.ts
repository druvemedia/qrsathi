import { z } from "zod";
import { clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings, saveGeneralSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

/** General site behaviour. Identity, colours and logos live in /api/admin/branding. */
export const GET = handle(async () => {
  await requireAdmin();
  const s = await getSettings();
  return json({ settings: { announcement: s.announcement, allowSignups: s.allowSignups } });
});

const schema = z.object({
  announcement: z.string().trim().max(200).refine((v) => !/[<>\u0000-\u001f]/.test(v), "Use plain text (no < or >)"),
  allowSignups: z.boolean(),
}).partial();

export const PUT = handle(async (req) => {
  const admin = await requireAdmin();
  await rateLimit(`admin-settings:${admin.id}`, 60, 15 * 60 * 1000);
  const body = await readJson(req, schema, 5_000);
  const before = await getSettings();
  await saveGeneralSettings(body);
  const changed = Object.fromEntries(Object.entries(body).filter(([k, v]) => (before as any)[k] !== v));
  await audit("admin.settings.updated", { actor: admin, targetType: "settings", ip: clientIp(req), details: { changed } });
  return json({ ok: true });
});
