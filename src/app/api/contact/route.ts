import { z } from "zod";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { logEvent } from "@/lib/log";
import { mailConfigured, sendMail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";

// Single-line fields: no control characters (also keeps them out of mail headers).
const line = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Maximum ${max} characters`).refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Use plain text on one line");

const TOPICS = ["account", "billing", "product", "bug", "other"] as const;

const schema = z.object({
  name: line("Name", 100),
  email: z.string().trim().max(200).pipe(z.email("Enter a valid e-mail address")),
  topic: z.enum(TOPICS),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(4000, "Maximum 4,000 characters"),
  /** Honeypot: hidden from people, filled by naive bots. */
  website: z.string().max(200).default(""),
});

/** Forwards a contact-form message to the configured support address. Nothing is stored. */
export const POST = handle(async (req) => {
  await rateLimit(`contact:${clientIp(req)}`, 5, 60 * 60 * 1000);
  await rateLimit("contact:global", 200, 60 * 60 * 1000);
  const body = await readJson(req, schema, 20_000);
  if (body.website) return json({ ok: true }); // pretend success; don't tell bots they were caught
  const { branding: b } = await getSettings();
  if (!b.supportEmail || !mailConfigured()) throw new ApiError(503, "The contact form isn't available right now. Please use the details on this page instead.");
  const sent = await sendMail({
    to: b.supportEmail,
    replyTo: body.email,
    subject: `[${b.brandName} contact] ${body.topic} — ${body.name}`.slice(0, 200),
    text: `From: ${body.name} <${body.email}>\nTopic: ${body.topic}\n\n${body.message}\n\n— Sent from the ${b.brandName} contact form. Reply to answer the sender.`,
  });
  // Log the event only; the message content stays out of the application log.
  await logEvent(sent ? "info" : "error", sent ? "contact.sent" : "contact.failed", `topic=${body.topic}`);
  if (!sent) throw new ApiError(502, "We couldn't send your message. Please try again later or e-mail us directly.");
  return json({ ok: true }, 201);
});
