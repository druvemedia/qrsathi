import { ApiError, clientIp, handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { mailConfigured, sendMail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";

/** SMTP is configured with environment variables only. Never returns the username or password. */
export const GET = handle(async () => {
  await requireAdmin();
  const port = Number(process.env.SMTP_PORT || 587);
  return json({
    configured: mailConfigured(),
    host: process.env.SMTP_HOST || "",
    port,
    security: port === 465 ? "TLS" : "STARTTLS (if offered)",
    authConfigured: !!process.env.SMTP_USER,
    from: process.env.MAIL_FROM || process.env.SMTP_USER || "",
  });
});

/** Sends a test message to the signed-in administrator's own address (never to an arbitrary recipient). */
export const POST = handle(async (req) => {
  const admin = await requireAdmin();
  await rateLimit(`admin-email-test:${admin.id}`, 3, 15 * 60 * 1000);
  if (!mailConfigured()) throw new ApiError(409, "SMTP isn't configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM on the server.");
  const { siteName } = await getSettings();
  const sent = await sendMail({ to: admin.email, subject: `${siteName}: test e-mail`, text: `This is a test message from the ${siteName} admin console. If you received it, password-reset e-mails can be delivered.` }).catch(() => false);
  if (!sent) {
    await audit("admin.email.test_failed", { actor: admin, targetType: "email", ip: clientIp(req) });
    throw new ApiError(502, "The SMTP server rejected the message or couldn't be reached. Check the server logs and SMTP settings.");
  }
  await audit("admin.email.test_sent", { actor: admin, targetType: "email", ip: clientIp(req) });
  return json({ ok: true, to: admin.email });
});
