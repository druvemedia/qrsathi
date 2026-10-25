import { logEvent } from "./log";

export function mailConfigured() {
  return !!process.env.SMTP_HOST;
}

/** Sends an email via SMTP. Without SMTP it logs to the console in development only. */
/** `replyTo` must already be a validated address (callers pass zod-checked input). */
export async function sendMail(msg: { to: string; subject: string; text: string; replyTo?: string }) {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[mail:dev] To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`);
      return true;
    }
    await logEvent("warn", "mail.not_configured", `Could not send "${msg.subject}" — SMTP is not configured.`);
    return false;
  }
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: msg.to, replyTo: msg.replyTo, subject: msg.subject, text: msg.text });
    return true;
  } catch (e) {
    await logEvent("error", "mail.failed", e instanceof Error ? e.message : String(e));
    return false;
  }
}
