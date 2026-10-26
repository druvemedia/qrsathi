/**
 * Password-reset and contact-form e-mail tests against a running production
 * build, using an in-process SMTP mock (no real mail leaves the machine).
 *
 * The server must be started with:
 *   SMTP_HOST=127.0.0.1 SMTP_PORT=2525 MAIL_FROM=noreply@example.test
 * (MAIL_MOCK_PORT overrides 2525 on both sides.) Any recipient containing
 * "smtp-reject" is refused with 550 to simulate a delivery failure.
 *
 *   BASE_URL=http://localhost:3100 [DATABASE_URL=file:…] npm run test:mail
 */
import net from "node:net";
import { createHash } from "node:crypto";

const BASE = process.env.BASE_URL || "http://localhost:3100";
const PORT = Number(process.env.MAIL_MOCK_PORT || 2525);
const RUN = Math.random().toString(36).slice(2, 8);
let pass = 0, fail = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond ? `  → ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
};

// ---------- minimal SMTP server ----------
interface Mail { from: string; to: string[]; raw: string; headers: Record<string, string>; body: string }
const inbox: Mail[] = [];
const rejected: string[] = [];
const decodeQP = (s: string) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
function parse(raw: string, from: string, to: string[]): Mail {
  const [head, ...rest] = raw.split(/\r?\n\r?\n/);
  const headers: Record<string, string> = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) headers[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
  }
  let body = rest.join("\n\n");
  if (/quoted-printable/i.test(headers["content-transfer-encoding"] || "")) body = decodeQP(body);
  if (/base64/i.test(headers["content-transfer-encoding"] || "")) body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
  return { from, to, raw, headers, body };
}
const smtp = net.createServer((sock) => {
  let from = "", to: string[] = [], data = false, buf = "";
  sock.write("220 mock.test ESMTP\r\n");
  sock.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    if (data) {
      const end = buf.indexOf("\r\n.\r\n");
      if (end < 0) return;
      inbox.push(parse(buf.slice(0, end).replace(/^\.\./gm, "."), from, to));
      buf = buf.slice(end + 5);
      data = false;
      sock.write("250 2.0.0 queued\r\n");
    }
    let i;
    while (!data && (i = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === "EHLO") sock.write("250-mock.test\r\n250 8BITMIME\r\n");
      else if (cmd === "HELO") sock.write("250 mock.test\r\n");
      else if (cmd === "MAIL") { from = line.slice(10).replace(/[<>]/g, "").trim(); to = []; sock.write("250 OK\r\n"); }
      else if (cmd === "RCPT") {
        const addr = line.slice(8).replace(/[<>]/g, "").trim();
        if (addr.includes("smtp-reject")) { rejected.push(addr); sock.write("550 5.1.1 mailbox unavailable\r\n"); }
        else { to.push(addr); sock.write("250 OK\r\n"); }
      } else if (cmd === "DATA") { data = true; sock.write("354 end with .\r\n"); }
      else if (cmd === "RSET" || cmd === "NOOP") sock.write("250 OK\r\n");
      else if (cmd === "QUIT") { sock.write("221 bye\r\n"); sock.end(); }
      else sock.write("502 not implemented\r\n");
    }
  });
  sock.on("error", () => {});
});
await new Promise<void>((r) => smtp.listen(PORT, "127.0.0.1", () => r()));

// ---------- helpers ----------
type Jar = Record<string, string>;
const cookieHeader = (j: Jar) => Object.entries(j).map(([k, v]) => `${k}=${v}`).join("; ");
let ipN = Math.floor(Math.random() * 200);
async function call(method: string, path: string, body?: unknown, jar?: Jar) {
  const res = await fetch(BASE + path, {
    method, redirect: "manual",
    headers: { Origin: BASE, "X-Forwarded-For": `10.88.${ipN++ % 250}.${Math.floor(Math.random() * 250)}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(jar ? { Cookie: cookieHeader(jar) } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (jar) for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"); const [k, ...v] = kv.split("="); jar[k.trim()] = v.join("="); }
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
async function waitForMail(pred: (m: Mail) => boolean, ms = 6000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const m = inbox.find(pred);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
const linkIn = (m: Mail | null) => m?.body.match(/https?:\/\/\S+\/reset-password\?token=[A-Za-z0-9_-]+/)?.[0] ?? null;
const db = process.env.DATABASE_URL ? new (await import("@prisma/client")).PrismaClient({ datasourceUrl: process.env.DATABASE_URL }) : null;
const created: string[] = [];

console.log(`Testing ${BASE} with an SMTP mock on 127.0.0.1:${PORT} (run ${RUN})`);
try {
  console.log("\n# Password reset");
  const email = `mail-${RUN}@example.com`;
  const U: Jar = {};
  const su = await call("POST", "/api/auth/signup", { name: "Mail Test", email, password: "first-pass-123", acceptTerms: true }, U);
  check("test user signed up", su.status === 201, su.data);
  created.push(email);

  const r1 = await call("POST", "/api/auth/forgot", { email });
  const rNo = await call("POST", "/api/auth/forgot", { email: `nobody-${RUN}@example.com` });
  check("same status and message for existing and unknown accounts", r1.status === 200 && rNo.status === 200 && JSON.stringify(r1.data) === JSON.stringify(rNo.data), [r1.data, rNo.data]);
  const m1 = await waitForMail((m) => m.to.includes(email));
  check("reset e-mail delivered to the account address", !!m1, inbox.map((m) => m.to));
  check("no e-mail sent for an unknown address", !(await waitForMail((m) => m.to.some((t) => t.startsWith("nobody-")), 1500)));
  const link1 = linkIn(m1);
  const appOrigin = new URL(process.env.APP_ORIGIN || BASE).origin;
  check("reset link uses the configured application origin", !!link1 && new URL(link1).origin === appOrigin, link1);
  check("reset link carries a long random token", !!link1 && new URL(link1).searchParams.get("token")!.length >= 40, link1);
  check("subject and sender set", /reset/i.test(m1?.headers.subject || "") && /@/.test(m1?.from || ""), m1?.headers);

  // A newer request invalidates the older link.
  inbox.length = 0;
  await call("POST", "/api/auth/forgot", { email });
  const link2 = linkIn(await waitForMail((m) => m.to.includes(email)));
  const tok1 = new URL(link1!).searchParams.get("token")!;
  const tok2 = new URL(link2!).searchParams.get("token")!;
  check("a new request issues a different token", !!tok2 && tok1 !== tok2);
  check("the older token stops working", (await call("POST", "/api/auth/reset", { token: tok1, password: "second-pass-123" })).status === 400);

  if (db) {
    const row = await db.passwordReset.findUnique({ where: { tokenHash: createHash("sha256").update(tok2).digest("hex") } });
    check("only the SHA-256 hash of the token is stored", !!row && !JSON.stringify(row).includes(tok2));
    check("token expires within about an hour", !!row && row.expiresAt.getTime() - Date.now() <= 60 * 60 * 1000 + 5000 && row.expiresAt.getTime() > Date.now());
  }

  const before = { ...U };
  const done = await call("POST", "/api/auth/reset", { token: tok2, password: "second-pass-123" });
  check("valid token resets the password", done.status === 200, done.data);
  check("reset signs out sessions created before it", (await call("GET", "/api/auth/me", undefined, before)).data?.user == null);
  check("token is single-use", (await call("POST", "/api/auth/reset", { token: tok2, password: "third-pass-1234" })).status === 400);
  check("old password no longer works", (await call("POST", "/api/auth/login", { email, password: "first-pass-123" })).status === 401);
  check("new password works", (await call("POST", "/api/auth/login", { email, password: "second-pass-123" }, {})).status === 200);

  if (db) {
    const expiring = `mail-exp-${RUN}@example.com`;
    await call("POST", "/api/auth/signup", { name: "Exp", email: expiring, password: "first-pass-123", acceptTerms: true }, {});
    created.push(expiring);
    await call("POST", "/api/auth/forgot", { email: expiring });
    const tok = new URL(linkIn(await waitForMail((m) => m.to.includes(expiring)))!).searchParams.get("token")!;
    await db.passwordReset.update({ where: { tokenHash: createHash("sha256").update(tok).digest("hex") }, data: { expiresAt: new Date(Date.now() - 1000) } });
    check("expired token rejected", (await call("POST", "/api/auth/reset", { token: tok, password: "second-pass-123" })).status === 400);
  }

  console.log("\n# SMTP failure");
  const bad = `smtp-reject-${RUN}@example.com`;
  await call("POST", "/api/auth/signup", { name: "Reject", email: bad, password: "first-pass-123", acceptTerms: true }, {});
  created.push(bad);
  const rb = await call("POST", "/api/auth/forgot", { email: bad });
  check("delivery failure gives the same generic response (no enumeration, no false success)", rb.status === 200 && JSON.stringify(rb.data) === JSON.stringify(rNo.data), rb.data);
  for (let i = 0; i < 60 && !rejected.includes(bad); i++) await new Promise((r) => setTimeout(r, 100));
  check("the mock refused the message (simulated failure happened)", rejected.includes(bad), rejected);
  if (db) {
    let logged = false;
    for (let i = 0; i < 30 && !logged; i++) {
      logged = (await db.log.count({ where: { event: "auth.password_reset_mail_failed", createdAt: { gt: new Date(Date.now() - 60_000) } } })) > 0;
      if (!logged) await new Promise((r) => setTimeout(r, 200));
    }
    check("failed delivery is logged for administrators", logged);
    const leak = await db.log.findMany({ where: { createdAt: { gt: new Date(Date.now() - 120_000) } }, select: { message: true } });
    check("logs never contain reset tokens", !leak.some((l) => /token=|reset-password\?/.test(l.message)));
  }

  console.log("\n# Contact form");
  const page = await (await fetch(BASE + "/contact")).text();
  if (!page.includes("Send message")) {
    console.log("SKIP  contact form hidden (no support e-mail configured in branding) — delivery not tested");
  } else {
    inbox.length = 0;
    const c = await call("POST", "/api/contact", { name: "Asha Rao", email: `reply-${RUN}@example.com`, topic: "product", message: "Hello — testing the contact form." });
    check("contact message accepted (201)", c.status === 201, c.data);
    const cm = await waitForMail((m) => /contact/i.test(m.headers.subject || ""));
    check("contact message delivered to the support address", !!cm, inbox.map((m) => m.headers.subject));
    check("Reply-To is the sender's address", (cm?.headers["reply-to"] || "").includes(`reply-${RUN}@example.com`), cm?.headers);
    check("message body included", (cm?.body || "").includes("testing the contact form"));
  }
} finally {
  if (db) {
    await db.user.deleteMany({ where: { email: { in: created } } });
    await db.$disconnect();
  }
  smtp.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
