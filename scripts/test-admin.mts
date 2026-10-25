/**
 * Authentication, RBAC, admin-console and security regression tests against a
 * running server whose database this process can also reach (to bootstrap
 * administrators with the CLI and to plant password-reset tokens).
 *
 *   BASE_URL=http://localhost:3100 DATABASE_URL=file:/abs/path/test.db [BUILD_DIR=.next-test] npm run test:admin
 *
 * NEVER point this at a production database: it creates and deletes accounts.
 */
import { spawnSync } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { currentStep, totpAt } from "../src/lib/mfa";

const BASE = (process.env.BASE_URL || "http://localhost:3100").replace(/\/$/, "");
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the test server's database.");
if (/prod/i.test(process.env.DATABASE_URL) && process.env.I_KNOW_THIS_IS_A_TEST_DB !== "true") throw new Error("Refusing: DATABASE_URL looks like production.");
const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const RUN = randomBytes(3).toString("hex");
const IP = `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

let pass = 0, fail = 0;
const check = (name: string, cond: unknown, info: unknown = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond ? `  → ${typeof info === "string" ? info : JSON.stringify(info)?.slice(0, 400)}` : ""}`);
};
const section = (s: string) => console.log(`\n# ${s}`);

type Jar = Record<string, string>;
const cookieHeader = (jar?: Jar) => (jar ? Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") : "");
function absorb(jar: Jar, res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    const k = kv.slice(0, i), v = kv.slice(i + 1);
    if (!v || /max-age=0/i.test(c) || /expires=thu, 01 jan 1970/i.test(c)) delete jar[k]; else jar[k] = v;
  }
}
async function call(method: string, p: string, body?: unknown, jar?: Jar, extra: Record<string, string> = {}) {
  const res = await fetch(BASE + p, {
    method, redirect: "manual",
    headers: { Origin: BASE, "X-Forwarded-For": IP, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(jar ? { Cookie: cookieHeader(jar) } : {}), ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (jar) absorb(jar, res);
  const text = await res.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, headers: res.headers, text };
}
const cli = (args: string[], password?: string) =>
  spawnSync("npx", ["tsx", "scripts/admin.mts", ...args, ...(password ? ["--password-stdin"] : [])], { input: password ? password + "\n" : undefined, encoding: "utf8", env: process.env, shell: process.platform === "win32" });

const email = (tag: string) => `t-${tag}-${RUN}@example.com`;
const created: string[] = [];

async function signup(tag: string, extra: Record<string, unknown> = {}) {
  const jar: Jar = {};
  const r = await call("POST", "/api/auth/signup", { name: `T ${tag}`, email: email(tag), password: "testpass123", acceptTerms: true, ...extra }, jar);
  created.push(email(tag));
  return { jar, r, email: email(tag) };
}

console.log(`Testing ${BASE} (run ${RUN})`);
try {
  section("Public endpoints & headers");
  const health = await call("GET", "/api/health");
  check("health returns only {status:'ok'}", health.status === 200 && JSON.stringify(health.data) === '{"status":"ok"}', health.data);
  const home = await fetch(BASE + "/");
  const csp = home.headers.get("content-security-policy") || "";
  check("CSP set (object-src none, frame-ancestors, no remote scripts)", /object-src 'none'/.test(csp) && /frame-ancestors 'self'/.test(csp) && /script-src 'self'/.test(csp) && !/script-src[^;]*https?:/.test(csp), csp);
  check("nosniff, frame and referrer headers", home.headers.get("x-content-type-options") === "nosniff" && home.headers.get("x-frame-options") === "SAMEORIGIN" && !!home.headers.get("referrer-policy"));
  check("no X-Powered-By", !home.headers.get("x-powered-by"));

  section("Sign-up can never create an administrator");
  const inj = await signup("inject", { role: "super_admin", isAdmin: true, plan: "business", status: "active", sessionVersion: 99 });
  check("sign-up with injected role succeeds as a normal user", inj.r.status === 201 && inj.r.data.user?.role === "user" && inj.r.data.user?.plan === "free", inj.r.data);
  const injRow = await db.user.findUnique({ where: { email: inj.email } });
  check("database row has role 'user'", injRow?.role === "user", injRow?.role);
  check("sign-up response has no hash, token or secret fields", !/passwordHash|tokenHash|mfaSecret|\$2[aby]\$/.test(inj.r.text), inj.r.text);
  check("workspace cookie is HttpOnly + SameSite=Lax", /qs_session=.*HttpOnly/i.test(inj.r.headers.getSetCookie().join()) && /SameSite=Lax/i.test(inj.r.headers.getSetCookie().join()));
  const me = await call("GET", "/api/auth/me", undefined, inj.jar);
  check("/api/auth/me has no secrets", me.data.user?.email === inj.email && !/passwordHash|mfaSecret|\$2[aby]\$/.test(me.text));
  const legacyAdmin = await signup("legacyadmin");
  check("ADMIN_EMAILS-style auto-promotion gone (any e-mail → user)", legacyAdmin.r.data.user?.role === "user");

  section("Admin APIs deny by default");
  const adminGets = ["stats", "users", "qrcodes", "reports", "payments", "subscriptions", "catalog", "analytics", "security", "logs", "settings", "system", "mfa"];
  let all401 = true;
  for (const e of adminGets) if ((await call("GET", `/api/admin/${e}`)).status !== 401) all401 = false;
  check(`all ${adminGets.length} admin GET endpoints → 401 without a session`, all401);
  check("admin mutations → 401 without a session", (await call("PATCH", "/api/admin/users/x", { status: "suspended" })).status === 401 && (await call("POST", "/api/admin/users/bulk", { ids: ["x"], action: "suspend" })).status === 401 && (await call("DELETE", "/api/admin/users/x")).status === 401 && (await call("PUT", "/api/admin/settings", {})).status === 401);
  let user401 = true;
  for (const e of adminGets) if ((await call("GET", `/api/admin/${e}`, undefined, inj.jar)).status !== 401) user401 = false;
  check("a workspace (user) session is rejected by every admin endpoint", user401);
  const swapped: Jar = { qs_admin: inj.jar.qs_session };
  check("user token replayed as the admin cookie is rejected", (await call("GET", "/api/admin/stats", undefined, swapped)).status === 401);
  const pageGuest = await fetch(BASE + "/admin/users", { redirect: "manual" });
  check("guest /admin/users → redirect to /admin/login", pageGuest.status === 307 && /\/admin\/login\?next=%2Fadmin%2Fusers/.test(pageGuest.headers.get("location") || ""), pageGuest.headers.get("location"));
  const pageUser = await fetch(BASE + "/admin", { redirect: "manual", headers: { Cookie: cookieHeader(inj.jar) } });
  check("signed-in ordinary user /admin → redirect to admin login", pageUser.status === 307 && /\/admin\/login/.test(pageUser.headers.get("location") || ""));
  const loginPage = await fetch(BASE + "/admin/login");
  const loginHtml = await loginPage.text();
  check("/admin/login renders, noindex, no-store", loginPage.status === 200 && /Administrator sign-in/.test(loginHtml) && /noindex/.test(loginPage.headers.get("x-robots-tag") || "") && /no-store/.test(loginPage.headers.get("cache-control") || ""));
  check("/admin/forgot-password renders", (await fetch(BASE + "/admin/forgot-password")).status === 200);

  section("Admin sign-in");
  const asUser = await call("POST", "/api/admin/auth/login", { email: inj.email, password: "testpass123" });
  const wrongPw = await call("POST", "/api/admin/auth/login", { email: inj.email, password: "wrong-pass-1" });
  const unknown = await call("POST", "/api/admin/auth/login", { email: `nobody-${RUN}@example.com`, password: "wrong-pass-1" });
  check("ordinary user with the correct password is refused (401)", asUser.status === 401 && !asUser.headers.getSetCookie().length, asUser.data);
  check("same generic error for non-admin, wrong password and unknown e-mail", asUser.data.error === wrongPw.data.error && wrongPw.data.error === unknown.data.error, [asUser.data.error, wrongPw.data.error, unknown.data.error]);

  const ADMIN = email("admin"), SUPER = email("super");
  created.push(ADMIN, SUPER);
  const weak = cli(["create", "--email", ADMIN], "short");
  check("CLI refuses a weak administrator password", weak.status !== 0 && /12 characters/.test(weak.stderr + weak.stdout));
  const argPw = spawnSync("npx", ["tsx", "scripts/admin.mts", "create", "--email", ADMIN, "--password", "Plaintext-Pass-123"], { encoding: "utf8", env: process.env, shell: process.platform === "win32" });
  check("CLI refuses passwords on the command line", argPw.status !== 0);
  check("CLI creates an admin", cli(["create", "--email", ADMIN], "Moderator-Pass-91x").status === 0);
  check("CLI creates a super admin", cli(["create", "--email", SUPER, "--super"], "Super-Test-Pass-82y").status === 0);

  const A: Jar = {};
  const al = await call("POST", "/api/admin/auth/login", { email: ADMIN, password: "Moderator-Pass-91x" }, A);
  check("admin signs in at /api/admin/auth/login", al.status === 200 && !!A.qs_admin && !A.qs_session, al.data);
  const adminCookie = al.headers.getSetCookie().join();
  check("admin cookie is HttpOnly + SameSite=Strict, 12 h max", /HttpOnly/i.test(adminCookie) && /SameSite=Strict/i.test(adminCookie) && /Max-Age=43200/i.test(adminCookie), adminCookie);
  check("admin (no MFA) can read stats", (await call("GET", "/api/admin/stats", undefined, A)).status === 200);
  check("admin-console cookie does not open the user workspace API", (await call("GET", "/api/products", undefined, A)).status === 401);
  const consoleHtml = await (await fetch(BASE + "/admin/users", { headers: { Cookie: cookieHeader(A) } })).text();
  check("admin console page renders without workspace navigation", /Admin console/.test(consoleHtml) && !/href="\/generator"/.test(consoleHtml) && !/href="\/inventory"/.test(consoleHtml));
  check("CSRF: admin mutation from another origin blocked (403)", (await call("PATCH", "/api/admin/users/x", { status: "active" }, A, { Origin: "https://evil.example" })).status === 403);

  section("Super administrator must enrol in MFA");
  const S: Jar = {};
  const sl = await call("POST", "/api/admin/auth/login", { email: SUPER, password: "Super-Test-Pass-82y" }, S);
  check("super admin login asks for MFA setup", sl.status === 200 && sl.data.mfaSetupRequired === true, sl.data);
  check("super admin without MFA: admin APIs → 403", (await call("GET", "/api/admin/stats", undefined, S)).status === 403);
  const sPage = await fetch(BASE + "/admin/users", { redirect: "manual", headers: { Cookie: cookieHeader(S) } });
  check("super admin without MFA: console pages → /admin/mfa", sPage.status === 307 && /\/admin\/mfa$/.test(sPage.headers.get("location") || ""), sPage.headers.get("location"));
  const st0 = await call("GET", "/api/admin/mfa", undefined, S);
  check("MFA status reports not enabled (never pretends)", st0.status === 200 && st0.data.enabled === false && st0.data.required === true, st0.data);
  const setup = await call("POST", "/api/admin/mfa", { action: "setup" }, S);
  const secret: string = setup.data.secret;
  check("setup returns a base32 secret + otpauth URI", /^[A-Z2-7]{32}$/.test(secret) && /^otpauth:\/\/totp\//.test(setup.data.otpauth), setup.data);
  const row = await db.user.findUnique({ where: { email: SUPER } });
  check("secret stored encrypted (not plaintext)", !!row?.mfaSecret && !row.mfaSecret.includes(secret) && row.mfaSecret.startsWith("v1:"));
  check("MFA not enabled before verification", row?.mfaEnabledAt === null);
  check("enable with a wrong code fails", (await call("POST", "/api/admin/mfa", { action: "enable", code: "000000" }, S)).status === 400);
  const oldS = { ...S };
  const enableCode = totpAt(secret, currentStep());
  const en = await call("POST", "/api/admin/mfa", { action: "enable", code: enableCode }, S);
  const recovery: string[] = en.data.recoveryCodes || [];
  check("enable returns 10 recovery codes once", en.status === 200 && recovery.length === 10, en.data);
  check("recovery codes stored only as hashes", (await db.mfaRecoveryCode.findMany({ where: { userId: row!.id } })).every((c) => c.codeHash.length === 64 && !recovery.includes(c.codeHash)));
  check("pre-MFA session is revoked after enabling", (await call("GET", "/api/admin/stats", undefined, oldS)).status === 401);
  check("new MFA session works", (await call("GET", "/api/admin/stats", undefined, S)).status === 200);
  check("super admin cannot disable MFA", (await call("POST", "/api/admin/mfa", { action: "disable", code: totpAt(secret, currentStep() + 1), password: "Super-Test-Pass-82y" }, S)).status === 403);

  section("Logout & MFA sign-in");
  const beforeLogout = { ...S };
  await call("POST", "/api/admin/auth/logout", {}, S);
  check("logout invalidates the session server-side (old cookie → 401)", (await call("GET", "/api/admin/stats", undefined, beforeLogout)).status === 401);
  const S2: Jar = {};
  const l2 = await call("POST", "/api/admin/auth/login", { email: SUPER, password: "Super-Test-Pass-82y" }, S2);
  check("password step returns an MFA ticket and no session", l2.data.mfaRequired === true && typeof l2.data.ticket === "string" && !S2.qs_admin, l2.data);
  check("wrong TOTP rejected", (await call("POST", "/api/admin/auth/mfa", { ticket: l2.data.ticket, code: "123456" }, S2)).status === 401);
  check("replayed TOTP (already used to enable) rejected", (await call("POST", "/api/admin/auth/mfa", { ticket: l2.data.ticket, code: enableCode }, S2)).status === 401);
  check("forged ticket rejected", (await call("POST", "/api/admin/auth/mfa", { ticket: l2.data.ticket.slice(0, -4) + "AAAA", code: totpAt(secret, currentStep() + 1) }, S2)).status === 401);
  const ok2 = await call("POST", "/api/admin/auth/mfa", { ticket: l2.data.ticket, code: totpAt(secret, currentStep() + 1) }, S2);
  check("valid TOTP completes sign-in", ok2.status === 200 && !!S2.qs_admin, ok2.data);
  await call("POST", "/api/admin/auth/logout", {}, S2);
  const S3: Jar = {};
  const l3 = await call("POST", "/api/admin/auth/login", { email: SUPER, password: "Super-Test-Pass-82y" }, S3);
  const rc = await call("POST", "/api/admin/auth/mfa", { ticket: l3.data.ticket, recoveryCode: recovery[0] }, S3);
  check("recovery code signs in once", rc.status === 200 && rc.data.recoveryCodesRemaining === 9, rc.data);
  const S4: Jar = {};
  const l4 = await call("POST", "/api/admin/auth/login", { email: SUPER, password: "Super-Test-Pass-82y" }, S4);
  check("used recovery code can't be reused", (await call("POST", "/api/admin/auth/mfa", { ticket: l4.data.ticket, recoveryCode: recovery[0] }, S4)).status === 401);
  const SUP = S3;

  section("User management & RBAC");
  const victim = await signup("victim");
  const vid = victim.r.data.user.id;
  const list = await call("GET", `/api/admin/users?q=${encodeURIComponent(victim.email)}`, undefined, A);
  check("user search works and returns no secrets", list.data.items?.length === 1 && !/passwordHash|mfaSecret|\$2[aby]\$|tokenHash/.test(list.text), list.data);
  check("pagination metadata", typeof list.data.total === "number" && list.data.page === 1 && list.data.pages >= 1);
  check("admin cannot change roles (403)", (await call("PATCH", `/api/admin/users/${vid}`, { role: "admin" }, A)).status === 403);
  const superRow = await db.user.findUnique({ where: { email: SUPER } });
  check("admin cannot touch a super admin (403)", (await call("PATCH", `/api/admin/users/${superRow!.id}`, { status: "suspended" }, A)).status === 403);
  check("admin cannot delete accounts (403)", (await call("DELETE", `/api/admin/users/${vid}`, undefined, A)).status === 403);
  check("admin can change an ordinary user's plan", (await call("PATCH", `/api/admin/users/${vid}`, { plan: "pro" }, A)).data.user?.plan === "pro");
  check("unknown fields in admin PATCH are ignored", (await call("PATCH", `/api/admin/users/${vid}`, { passwordHash: "x", plan: "pro" }, A)).status === 200 && (await db.user.findUnique({ where: { id: vid } }))?.passwordHash !== "x");
  const sus = await call("PATCH", `/api/admin/users/${vid}`, { status: "suspended" }, A);
  check("admin suspends a user", sus.data.user?.status === "suspended", sus.data);
  check("suspension ends the user's sessions immediately", (await call("GET", "/api/auth/me", undefined, victim.jar)).data.user === null);
  const blockedLogin = await call("POST", "/api/auth/login", { email: victim.email, password: "testpass123" });
  check("suspended user cannot sign in", blockedLogin.status === 403 || blockedLogin.status === 401, blockedLogin.status);
  check("admin reactivates", (await call("PATCH", `/api/admin/users/${vid}`, { status: "active" }, A)).data.user?.status === "active");
  const bulk = await call("POST", "/api/admin/users/bulk", { ids: [vid, (await db.user.findUnique({ where: { email: ADMIN } }))!.id], action: "suspend" }, A);
  check("bulk action skips the actor's own account", bulk.data.done === 1 && bulk.data.failed === 1, bulk.data);
  await call("PATCH", `/api/admin/users/${vid}`, { status: "active" }, A);
  check("super admin cannot change own role", (await call("PATCH", `/api/admin/users/${superRow!.id}`, { role: "admin" }, SUP)).status === 400);
  const promote = await call("PATCH", `/api/admin/users/${vid}`, { role: "admin" }, SUP);
  check("super admin can promote (role change audited)", promote.data.user?.role === "admin", promote.data);
  check("super admin can demote back", (await call("PATCH", `/api/admin/users/${vid}`, { role: "user" }, SUP)).data.user?.role === "user");
  const reset = await call("POST", `/api/admin/users/${vid}`, { action: "send_password_reset" }, A);
  check("admin can trigger a reset e-mail (never sees the token)", reset.status === 200 && !/token=/.test(reset.text), reset.data);

  section("Audit log");
  const audit = await call("GET", "/api/admin/security?category=admin&pageSize=100", undefined, SUP);
  const actions = (audit.data.items || []).map((a: any) => a.action);
  check("suspension, reactivation, role change and plan change audited", ["admin.user.suspended", "admin.user.reactivated", "admin.user.role_changed", "admin.user.updated"].every((a) => actions.includes(a)), actions);
  check("failed admin sign-ins audited", (await db.auditLog.count({ where: { action: { in: ["admin.auth.login_denied", "auth.login_failed", "admin.auth.login_failed"] } } })) > 0);
  check("MFA failures audited", (await db.auditLog.count({ where: { action: "admin.auth.mfa_failed" } })) > 0);
  check("audit records contain no passwords, codes or secrets", !/Super-Test-Pass|Admin-Test-Pass|testpass123|passwordHash/.test(JSON.stringify(await db.auditLog.findMany({ take: 500, orderBy: { createdAt: "desc" } }))));

  section("Settings validation & stored XSS");
  const original = (await call("GET", "/api/admin/settings", undefined, A)).data.settings;
  check("invalid support e-mail rejected", (await call("PUT", "/api/admin/settings", { supportEmail: "not-an-email" }, A)).status === 400);
  check("unknown brand colour rejected", (await call("PUT", "/api/admin/settings", { brand: "<script>" }, A)).status === 400);
  await call("PUT", "/api/admin/settings", { siteName: "</script><script>alert(1)</script>" }, A);
  const homeHtml = await (await fetch(BASE + "/")).text();
  check("site name can't break out of the JSON-LD script", !homeHtml.includes("</script><script>alert(1)</script>"));
  await call("PUT", "/api/admin/settings", { siteName: original.siteName }, A);

  section("Sessions, passwords & reset tokens");
  const U = await signup("sess");
  const second: Jar = {};
  await call("POST", "/api/auth/login", { email: U.email, password: "testpass123" }, second);
  const firstCookie = U.jar.qs_session;
  await call("POST", "/api/auth/login", { email: U.email, password: "testpass123" }, U.jar);
  check("re-login issues a new session id (fixation)", U.jar.qs_session !== firstCookie);
  check("the replaced session is revoked", (await call("GET", "/api/auth/me", undefined, { qs_session: firstCookie })).data.user === null);
  const ch = await call("PATCH", "/api/account", { currentPassword: "testpass123", newPassword: "newpass456" }, U.jar);
  check("password change succeeds", ch.status === 200, ch.data);
  check("password change signs out other sessions", (await call("GET", "/api/auth/me", undefined, second)).data.user === null);
  check("…but keeps the current browser signed in", (await call("GET", "/api/auth/me", undefined, U.jar)).data.user?.email === U.email);
  const logoutJar = { ...U.jar };
  await call("POST", "/api/auth/logout", {}, U.jar);
  check("user logout invalidates the token server-side", (await call("GET", "/api/auth/me", undefined, logoutJar)).data.user === null);

  const f1 = await call("POST", "/api/auth/forgot", { email: U.email });
  const f2 = await call("POST", "/api/auth/forgot", { email: `ghost-${RUN}@example.com` });
  check("forgot-password: identical response for existing and unknown e-mail", f1.status === f2.status && JSON.stringify(f1.data) === JSON.stringify(f2.data), [f1.data, f2.data]);
  const uRow = await db.user.findUnique({ where: { email: U.email } });
  const token = randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: uRow!.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) } });
  const other: Jar = {};
  await call("POST", "/api/auth/login", { email: U.email, password: "newpass456" }, other);
  const rs = await call("POST", "/api/auth/reset", { token, password: "resetpass789" });
  check("reset with a valid token succeeds", rs.status === 200, rs.data);
  check("reset signs out existing sessions", (await call("GET", "/api/auth/me", undefined, other)).data.user === null);
  check("reset token is single-use", (await call("POST", "/api/auth/reset", { token, password: "another123x" })).status === 400);
  const expired = randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: uRow!.id, tokenHash: createHash("sha256").update(expired).digest("hex"), expiresAt: new Date(Date.now() - 1000) } });
  check("expired token rejected", (await call("POST", "/api/auth/reset", { token: expired, password: "another123x" })).status === 400);
  check("token is stored only as a hash", !(await db.passwordReset.findMany({ where: { userId: uRow!.id } })).some((r) => r.tokenHash === token));

  section("IDOR & uploads");
  const owner = await signup("owner");
  const qr = await call("POST", "/api/qrcodes", { name: "Mine", type: "dynamic", content: { url: "https://example.com/a" }, design: {} }, owner.jar);
  check("user B can't read A's QR code (404)", (await call("GET", `/api/qrcodes/${qr.data.item.id}`, undefined, U.jar)).status === 404 || (await call("GET", `/api/qrcodes/${qr.data.item.id}`, undefined, inj.jar)).status === 404);
  check("user B can't delete A's QR code", [403, 404].includes((await call("DELETE", `/api/qrcodes/${qr.data.item.id}`, undefined, inj.jar)).status));
  const scanIp = `10.55.${Math.floor(Math.random() * 250)}.9`;
  const hits = [];
  for (let i = 0; i < 25; i++) hits.push((await fetch(`${BASE}/r/${qr.data.item.shortCode}`, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile", "X-Forwarded-For": scanIp } })).status);
  const recorded = await db.scan.count({ where: { qrId: qr.data.item.id } });
  check("scan recording capped per client (25 visits → 20 scans; every visitor still redirected)", recorded === 20 && hits.every((s) => s === 302), { recorded, hits: [...new Set(hits)] });
  const big = await fetch(BASE + "/api/uploads", { method: "POST", headers: { Origin: BASE, "X-Forwarded-For": IP, Cookie: cookieHeader(owner.jar), "Content-Type": "multipart/form-data; boundary=x" }, body: new Uint8Array(11 * 1024 * 1024 + 100_000) });
  check("oversized upload rejected before parsing (413)", big.status === 413, big.status);

  if (process.env.TEST_WEBHOOK_SECRET) {
    section("Billing webhook (signed locally; no real Razorpay)");
    const payer = await signup("payer");
    const pid = payer.r.data.user.id;
    const ref = `plink_test_${RUN}`;
    await db.payment.create({ data: { userId: pid, provider: "razorpay", providerRef: ref, plan: "pro", amount: 29900 } });
    const hook = (body: unknown, sig?: string) => {
      const raw = JSON.stringify(body);
      const s = sig ?? createHmac("sha256", process.env.TEST_WEBHOOK_SECRET!).update(raw).digest("hex");
      return fetch(BASE + "/api/billing/webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Razorpay-Signature": s }, body: raw });
    };
    const evt = (amount: number) => ({ event: "payment_link.paid", payload: { payment_link: { entity: { id: ref, status: "paid", amount_paid: amount } } } });
    check("forged signature rejected (400)", (await hook(evt(29900), "0".repeat(64))).status === 400);
    await hook(evt(100));
    check("underpaid link does not upgrade", (await db.user.findUnique({ where: { id: pid } }))?.plan === "free");
    const burst = await Promise.all([hook(evt(29900)), hook(evt(29900)), hook(evt(29900))]);
    const u1 = await db.user.findUnique({ where: { id: pid } });
    check("valid signed webhook activates the plan", burst.every((r) => r.status === 200) && u1?.plan === "pro", u1?.plan);
    const days = (u1!.planExpiresAt!.getTime() - Date.now()) / 86400000;
    check("concurrent duplicate deliveries extend the plan only once (~30 days)", days > 29 && days < 31, days);
    const big = await fetch(BASE + "/api/billing/webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Razorpay-Signature": "x" }, body: "x".repeat(300_000) });
    check("oversized webhook body rejected (413)", big.status === 413, big.status);
  }

  section("Rate limiting");
  const rlIp = `10.99.${Math.floor(Math.random() * 250)}.1`;
  let last = 0;
  for (let i = 0; i < 6; i++) last = (await call("POST", "/api/admin/auth/login", { email: `rl-${RUN}@example.com`, password: "x".repeat(10) }, undefined, { "X-Forwarded-For": rlIp })).status;
  check("6th admin sign-in attempt for one account → 429", last === 429, last);

  if (process.env.BUILD_DIR) {
    section("Client bundle");
    const dir = path.join(process.env.BUILD_DIR, "static");
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
    walk(dir);
    const secrets = [process.env.TEST_AUTH_SECRET, process.env.TEST_MFA_KEY].filter(Boolean) as string[];
    const leaks = files.filter((f) => /\.(js|css|json)$/.test(f)).filter((f) => { const s = readFileSync(f, "utf8"); return secrets.some((x) => s.includes(x)) || /DATABASE_URL|RAZORPAY_KEY_SECRET|SMTP_PASS|GOOGLE_CLIENT_SECRET|bcrypt\.hash/.test(s); });
    check(`no server secrets or secret env names in ${files.length} client files`, secrets.length > 0 && leaks.length === 0, leaks);
  }
} finally {
  const ids = (await db.user.findMany({ where: { email: { in: created } }, select: { id: true } })).map((u) => u.id);
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
  console.log(`\n(${ids.length} test accounts deleted)`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
