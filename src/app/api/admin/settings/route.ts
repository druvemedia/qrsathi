import { z } from "zod";
import { clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { BRAND_COLORS, getSettings, saveSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

export const GET = handle(async () => {
  await requireAdmin();
  return json({ settings: await getSettings() });
});

const schema = z.object({
  siteName: z.string().trim().min(1).max(40),
  tagline: z.string().trim().max(120),
  brand: z.string().refine((b) => b in BRAND_COLORS, "Unknown brand colour"),
  announcement: z.string().trim().max(200),
  allowSignups: z.boolean(),
  supportEmail: z.string().trim().max(200).refine((v) => !v || z.email().safeParse(v).success, "Enter a valid support e-mail"),
  companyName: z.string().trim().min(1).max(100),
}).partial();

export const PUT = handle(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson(req, schema, 20_000);
  const before = await getSettings();
  await saveSettings(body);
  const changed = Object.fromEntries(Object.entries(body).filter(([k, v]) => (before as any)[k] !== v));
  await audit("admin.settings.updated", { actor: admin, targetType: "settings", ip: clientIp(req), details: { changed } });
  return json({ ok: true });
});
