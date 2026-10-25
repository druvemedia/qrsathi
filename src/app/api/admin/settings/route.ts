import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { BRAND_COLORS, getSettings, saveSettings } from "@/lib/settings";
import { logEvent } from "@/lib/log";
import { googleConfigured, razorpayConfigured, demoMode } from "@/lib/config";
import { mailConfigured } from "@/lib/mail";

export const GET = handle(async () => {
  await requireAdmin();
  return json({
    settings: await getSettings(),
    integrations: { google: googleConfigured(), razorpay: razorpayConfigured(), smtp: mailConfigured(), demo: demoMode(), appUrl: process.env.NEXT_PUBLIC_APP_URL || "" },
  });
});

const schema = z.object({
  siteName: z.string().trim().min(1).max(40),
  tagline: z.string().trim().max(120),
  brand: z.string().refine((b) => b in BRAND_COLORS, "Unknown brand colour"),
  announcement: z.string().trim().max(200),
  allowSignups: z.boolean(),
  supportEmail: z.string().trim().max(200),
  companyName: z.string().trim().min(1).max(100),
}).partial();

export const PUT = handle(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson(req, schema);
  await saveSettings(body);
  await logEvent("info", "admin.settings_updated", Object.keys(body).join(", "), admin.id);
  return json({ ok: true });
});
