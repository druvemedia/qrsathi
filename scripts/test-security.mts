/**
 * Offline security regression tests (no server, no database connection).
 * Each block guards a finding from docs/SECURITY-AUDIT.md.
 *   npm run test:security
 */
process.env.AUTH_SECRET ||= "test-only-secret-0123456789-abcdefghijklmnop";
process.env.MFA_ENCRYPTION_KEY ||= "test-only-mfa-key-0123456789-abcdefghijklmnop";
delete process.env.RATE_LIMIT_STORE; // memory store
delete process.env.TRUST_PROXY;

const { safeNextPath } = await import("../src/lib/safe-redirect");
const { maskEmail, redact, redactText } = await import("../src/lib/redact");
const { safeJsonLd } = await import("../src/lib/utils");
const { checkEnv } = await import("../src/lib/env-check");
const mfa = await import("../src/lib/mfa");
const { rateLimit, withinLimit } = await import("../src/lib/rate-limit");
const { ipFromHeaders } = await import("../src/lib/api");
const { allowedOrigins } = await import("../src/middleware");
const { assertCanManage, assertNotLastSuperAdmin } = await import("../src/lib/admin-users");
const { isAdminRole, isSuperAdmin } = await import("../src/lib/roles");
const { toMysql } = await import("./db/mysql-schema.mjs");
const { readFileSync } = await import("node:fs");

let pass = 0, fail = 0;
function t(name: string, cond: unknown, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✖ ${name}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ""}`); }
}
async function throws(fn: () => Promise<unknown>, status?: number) {
  try { await fn(); return false; } catch (e: any) { return status === undefined || e?.status === status; }
}
const section = (s: string) => console.log(`\n${s}`);

section("Open redirect (safeNextPath)");
for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "/%0d%0aSet-Cookie:x", "/\tfoo", "/" + "a".repeat(600), "", null, undefined])
  t(`rejects ${JSON.stringify(bad)?.slice(0, 30)}`, safeNextPath(bad as any) === "/dashboard" || (typeof bad === "string" && bad.startsWith("/%0d") && !safeNextPath(bad).includes("\n")));
t("keeps a same-origin path with query and hash", safeNextPath("/products?id=1#x") === "/products?id=1#x");
t("custom fallback", safeNextPath("//x", "/admin") === "/admin");

section("Redaction (logs & audit)");
const r = redact({ password: "hunter2", token: "abc", nested: { secret: "s", apiKey: "k", totp: "123456", recoveryCode: "r" }, email: "user@example.com", ok: "visible" }) as any;
t("password/token/secret/apiKey/totp/recovery keys redacted", r.password === "[redacted]" && r.token === "[redacted]" && r.nested.secret === "[redacted]" && r.nested.apiKey === "[redacted]" && r.nested.totp === "[redacted]" && r.nested.recoveryCode === "[redacted]", r);
t("e-mail values masked", r.email !== "user@example.com" && /\*/.test(r.email), r.email);
t("ordinary values kept", r.ok === "visible");
t("redactText masks token=… in messages", !redactText("GET /reset?token=abcdef123456").includes("abcdef123456"));
t("redactText masks long opaque strings", !redactText("cookie qs_session eyJhbGciOiJIUzI1NiJ9.eyJzaWQiOiJhYmMifQ.signaturepart").includes("eyJzaWQiOiJhYmMifQ"));
t("maskEmail keeps domain only partly", maskEmail("asha.verma@example.in") !== "asha.verma@example.in");

section("Stored XSS via JSON-LD (safeJsonLd)");
const ld = safeJsonLd({ name: "</script><script>alert(1)</script>", t: "a&b " });
t("no raw '<' or '>' in output", !/[<>]/.test(ld), ld);
t("round-trips to the same data", JSON.parse(ld).name === "</script><script>alert(1)</script>");

section("Startup configuration validation (env-check)");
const prodBase = { NODE_ENV: "production", DATABASE_URL: "mysql://u:p@h/db", AUTH_SECRET: "x".repeat(10) + "Q7v1pM2kR8sN4tB6wE9yH3jL5zC0aD", NEXT_PUBLIC_APP_URL: "https://qr.example.in", MFA_ENCRYPTION_KEY: "m".repeat(40), RATE_LIMIT_STORE: "database", SMTP_HOST: "smtp" };
t("valid production config passes", checkEnv(prodBase).errors.length === 0, checkEnv(prodBase).errors);
t("short AUTH_SECRET fails", checkEnv({ ...prodBase, AUTH_SECRET: "short" }).errors.length > 0);
t("placeholder AUTH_SECRET fails in production", checkEnv({ ...prodBase, AUTH_SECRET: "change-me-to-a-long-random-string-please" }).errors.length > 0);
t("http public URL fails in production", checkEnv({ ...prodBase, NEXT_PUBLIC_APP_URL: "http://qr.example.in" }).errors.length > 0);
t("http://localhost allowed for local production tests", checkEnv({ ...prodBase, NEXT_PUBLIC_APP_URL: "http://localhost:3100" }).errors.length === 0);
t("missing public URL fails in production", checkEnv({ ...prodBase, NEXT_PUBLIC_APP_URL: "" }).errors.length > 0);
t("DEMO_MODE=true fails in production", checkEnv({ ...prodBase, DEMO_MODE: "true" }).errors.length > 0);
t("secret in NEXT_PUBLIC_* fails", checkEnv({ ...prodBase, NEXT_PUBLIC_RAZORPAY_KEY_SECRET: "x" }).errors.length > 0);
t("Razorpay without webhook secret fails in production", checkEnv({ ...prodBase, RAZORPAY_KEY_ID: "a", RAZORPAY_KEY_SECRET: "b" }).errors.length > 0);
t("ADMIN_EMAILS produces a deprecation warning", checkEnv({ ...prodBase, ADMIN_EMAILS: "a@b.c" }).warnings.some((w) => /ADMIN_EMAILS/.test(w)));
t("invalid TRUST_PROXY fails", checkEnv({ ...prodBase, TRUST_PROXY: "yes" }).errors.length > 0);

section("TOTP (RFC 6238 vectors, SHA-1)");
const rfc = mfa.base32Encode(Buffer.from("12345678901234567890"));
t("T=59 → 94287082", mfa.totpAt(rfc, Math.floor(59 / 30), 8) === "94287082");
t("T=1111111109 → 07081804", mfa.totpAt(rfc, Math.floor(1111111109 / 30), 8) === "07081804");
t("T=1234567890 → 89005924", mfa.totpAt(rfc, Math.floor(1234567890 / 30), 8) === "89005924");
t("T=20000000000 → 65353130", mfa.totpAt(rfc, Math.floor(20000000000 / 30), 8) === "65353130");
const secret = mfa.generateSecret();
const now = Date.UTC(2026, 9, 25, 12, 0, 0);
const step = mfa.currentStep(now);
t("current code accepted", mfa.verifyTotp(secret, mfa.totpAt(secret, step), 0, now) === step);
t("±1 step drift accepted", mfa.verifyTotp(secret, mfa.totpAt(secret, step - 1), 0, now) === step - 1);
t("±2 steps rejected", mfa.verifyTotp(secret, mfa.totpAt(secret, step - 2), 0, now) === null);
t("replay of an accepted step rejected", mfa.verifyTotp(secret, mfa.totpAt(secret, step), step, now) === null);
t("non-numeric / wrong-length codes rejected", mfa.verifyTotp(secret, "12a456", 0, now) === null && mfa.verifyTotp(secret, "1234567", 0, now) === null);

section("MFA secret encryption & recovery codes");
const enc = mfa.encryptSecret(secret);
t("ciphertext doesn't contain the secret", !enc.includes(secret));
t("decrypts back", mfa.decryptSecret(enc) === secret);
t("two encryptions differ (random IV)", mfa.encryptSecret(secret) !== enc);
const parts = enc.split(":");
parts[3] = Buffer.from(parts[3], "base64url").map((b, i) => (i === 0 ? b ^ 1 : b)).toString("base64url");
t("tampered ciphertext is rejected (GCM tag)", (() => { try { mfa.decryptSecret(parts.join(":")); return false; } catch { return true; } })());
const codes = mfa.generateRecoveryCodes(10);
t("10 unique recovery codes", new Set(codes).size === 10 && codes.every((c) => /^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/.test(c)), codes[0]);
t("recovery code hash is stable and normalised", mfa.hashRecoveryCode(codes[0]) === mfa.hashRecoveryCode(` ${codes[0].toUpperCase()} `));
t("hash isn't the code", mfa.hashRecoveryCode(codes[0]) !== codes[0] && mfa.hashRecoveryCode(codes[0]).length === 64);

section("Rate limiting");
const key = `test:${Math.random()}`;
let blocked = false;
for (let i = 0; i < 6; i++) { try { await rateLimit(key, 5, 60_000); } catch (e: any) { blocked = e?.status === 429; } }
t("6th request in window → 429", blocked);
t("withinLimit is non-throwing", (await withinLimit(key, 5, 60_000)) === false);

section("Client IP (spoofing)");
const h = (o: Record<string, string>) => new Headers(o);
t("without TRUST_PROXY: right-most X-Forwarded-For (not attacker-controlled left-most)", ipFromHeaders(h({ "x-forwarded-for": "1.1.1.1, 9.9.9.9" })) === "9.9.9.9");
t("without TRUST_PROXY: X-Real-IP ignored", ipFromHeaders(h({ "x-real-ip": "6.6.6.6" })) === "unknown");
t("without TRUST_PROXY: CF-Connecting-IP ignored", ipFromHeaders(h({ "cf-connecting-ip": "6.6.6.6" })) === "unknown");
process.env.TRUST_PROXY = "cloudflare";
t("TRUST_PROXY=cloudflare uses CF-Connecting-IP", ipFromHeaders(h({ "cf-connecting-ip": "5.5.5.5", "x-forwarded-for": "1.1.1.1" })) === "5.5.5.5");
delete process.env.TRUST_PROXY;

section("CSRF origin allow-list (middleware)");
const req = (o: Record<string, string>) => ({ headers: new Headers(o) }) as any;
const prodEnv = { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://qr.example.in" };
t("production: only the configured origin", [...allowedOrigins(req({ host: "qr.example.in" }), prodEnv)].join() === "https://qr.example.in");
t("production: forged Host/X-Forwarded-Host can't add origins", !allowedOrigins(req({ host: "evil.com", "x-forwarded-host": "evil.com" }), prodEnv).has("https://evil.com"));
t("dev: forwarded host ignored without TRUST_PROXY", !allowedOrigins(req({ host: "localhost:3000", "x-forwarded-host": "evil.com" }), { NODE_ENV: "development" }).has("http://evil.com"));
t("dev: own host allowed", allowedOrigins(req({ host: "localhost:3000" }), { NODE_ENV: "development" }).has("http://localhost:3000"));

section("RBAC rules");
const u = (id: string, role: string, status = "active") => ({ id, role, status }) as any;
t("roles: user isn't admin", !isAdminRole("user") && isAdminRole("admin") && isAdminRole("super_admin") && !isSuperAdmin("admin"));
t("roles: unknown/empty roles aren't admin", !isAdminRole("Admin") && !isAdminRole("") && !isAdminRole(undefined));
t("admin can suspend an ordinary user", !(await throws(() => assertCanManage(u("a", "admin"), u("b", "user"), "status"))));
t("admin cannot change roles", await throws(() => assertCanManage(u("a", "admin"), u("b", "user"), "role"), 403));
t("admin cannot delete accounts", await throws(() => assertCanManage(u("a", "admin"), u("b", "user"), "delete"), 403));
t("admin cannot manage another admin", await throws(() => assertCanManage(u("a", "admin"), u("b", "admin"), "sessions"), 403));
t("admin cannot manage a super admin", await throws(() => assertCanManage(u("a", "admin"), u("b", "super_admin"), "status"), 403));
t("super admin can change roles", !(await throws(() => assertCanManage(u("a", "super_admin"), u("b", "admin"), "role"))));
t("nobody can suspend/demote/delete themselves", await throws(() => assertCanManage(u("a", "super_admin"), u("a", "super_admin"), "status"), 400) && await throws(() => assertCanManage(u("a", "super_admin"), u("a", "super_admin"), "role"), 400) && await throws(() => assertCanManage(u("a", "super_admin"), u("a", "super_admin"), "delete"), 400));
t("last-super-admin check skipped for non-super targets", !(await throws(() => assertNotLastSuperAdmin(u("b", "admin"), { role: "user" }))));

section("MySQL schema generator");
const mysql = toMysql(readFileSync("prisma/schema.prisma", "utf8"));
t("provider is mysql", /provider\s+=\s+"mysql"/.test(mysql));
t("long barcode values sized and prefix-indexed", mysql.includes("@db.VarChar(1500)") && mysql.includes("value(length: 512)"));
t("no TEXT column carries a literal default (MySQL rejects it)", !/@default\("[^"]*"\)\s+@db\.(Medium)?Text/.test(mysql));
t("committed prisma/mysql/schema.prisma is up to date", readFileSync("prisma/mysql/schema.prisma", "utf8").replace(/\r\n/g, "\n") === mysql);
t("init migration applies binary collation to short codes", /MODIFY `shortCode` VARCHAR\(191\) NULL COLLATE utf8mb4_bin/.test(readFileSync("prisma/mysql/migrations/20261025000000_init/migration.sql", "utf8")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
