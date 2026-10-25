import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, handle, json, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/log";

const schema = z.object({
  shortCode: z.string().trim().max(60).default(""),
  url: z.string().trim().max(2000).default(""),
  reason: z.enum(["phishing", "scam", "malware", "payment_fraud", "illegal", "spam", "other"]),
  details: z.string().trim().max(2000).default(""),
  email: z.string().trim().max(200).refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email").default(""),
});

export const POST = handle(async (req) => {
  await rateLimit(`report:${clientIp(req)}`, 10, 60 * 60 * 1000);
  await rateLimit("report:global", 500, 60 * 60 * 1000);
  const body = await readJson(req, schema);
  const code = body.shortCode || /\/(?:r|p)\/([\w-]{3,40})/.exec(body.url)?.[1] || "";
  await db.abuseReport.create({
    data: { shortCode: code, url: body.url, reason: body.reason, details: body.details, reporterEmail: body.email },
  });
  await logEvent("warn", "abuse.reported", `${body.reason} ${code || body.url}`.slice(0, 300));
  return json({ ok: true }, 201);
});
