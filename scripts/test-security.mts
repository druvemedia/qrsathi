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

section("Credential encryption (secret-box)");
{
  const prev = process.env.SETTINGS_ENCRYPTION_KEY;
  process.env.SETTINGS_ENCRYPTION_KEY = "unit-test-settings-key-0123456789abcdefghij";
  const box = await import("../src/lib/secret-box");
  const sealed = box.seal("rzp-secret-value-123", "razorpay.test.keySecret");
  t("sealed value doesn't contain the plaintext", !sealed.includes("rzp-secret-value-123") && sealed.startsWith("sb1:"));
  t("opens with the same purpose", box.open(sealed, "razorpay.test.keySecret") === "rzp-secret-value-123");
  t("bound to its field (other purpose fails)", (() => { try { box.open(sealed, "razorpay.live.keySecret"); return false; } catch { return true; } })());
  const p = sealed.split(":"); p[3] = Buffer.from(p[3], "base64url").map((b, i) => (i === 0 ? b ^ 1 : b)).toString("base64url");
  t("tampering is detected", (() => { try { box.open(p.join(":"), "razorpay.test.keySecret"); return false; } catch { return true; } })());
  process.env.SETTINGS_ENCRYPTION_KEY = "a-different-key-0123456789abcdefghijklmnop";
  t("a different key can't decrypt", (() => { try { box.open(sealed, "razorpay.test.keySecret"); return false; } catch { return true; } })());
  delete process.env.SETTINGS_ENCRYPTION_KEY;
  t("no key → storage unavailable and sealing refuses", !box.settingsKeyAvailable() && (() => { try { box.seal("x", "y"); return false; } catch { return true; } })());
  if (prev) process.env.SETTINGS_ENCRYPTION_KEY = prev;
}

section("Razorpay signatures");
{
  const rz = await import("../src/lib/razorpay");
  const { createHmac } = await import("node:crypto");
  const sig = createHmac("sha256", "key_secret_x").update("pay_123|sub_456").digest("hex");
  t("valid checkout signature accepted", rz.verifySubscriptionSignature("pay_123", "sub_456", sig, "key_secret_x"));
  t("signature for another subscription rejected", !rz.verifySubscriptionSignature("pay_123", "sub_999", sig, "key_secret_x"));
  t("wrong secret rejected", !rz.verifySubscriptionSignature("pay_123", "sub_456", sig, "other"));
  t("empty / malformed signature rejected", !rz.verifySubscriptionSignature("pay_123", "sub_456", "", "key_secret_x") && !rz.verifySubscriptionSignature("pay_123", "sub_456", "zz", "key_secret_x"));
  const body = JSON.stringify({ event: "subscription.charged" });
  const wsig = createHmac("sha256", "whsec").update(body).digest("hex");
  t("webhook signature over the raw body accepted", rz.verifyWebhookSignature(body, wsig, "whsec"));
  t("re-serialised body (whitespace change) rejected", !rz.verifyWebhookSignature(JSON.stringify(JSON.parse(body), null, 1), wsig, "whsec"));
  t("key prefix selects mode", rz.modeOfKey("rzp_test_abc") === "test" && rz.modeOfKey("rzp_live_abc") === "live" && rz.modeOfKey("abc") === null);
}

section("Money & plans");
{
  const pl = await import("../src/lib/plans");
  t("parseMoney is exact (no floats)", pl.parseMoney("299") === 29900 && pl.parseMoney("299.5") === 29950 && pl.parseMoney("0.07") === 7 && pl.parseMoney("1,999.99") === 199999);
  t("parseMoney rejects bad input", [ "-1", "1.234", "abc", "", "1e3" ].every((v) => pl.parseMoney(v) === null));
  t("formatMoney", pl.formatMoney(29900) === "₹299" && pl.formatMoney(29950) === "₹299.50" && pl.formatMoney(1999900, "USD") === "$19,999");
  t("annual discount", pl.annualDiscount({ monthlyPrice: 29900, annualPrice: 299000 }) === 17 && pl.annualDiscount({ monthlyPrice: 0, annualPrice: 100 }) === null);
  const ok = { id: "team", name: "Team", description: "", currency: "INR", monthlyPrice: 49900, annualPrice: 0, features: ["A"], limits: pl.DEFAULT_PLANS[1].limits, featured: false, sortOrder: 3 };
  t("valid plan accepted", pl.planInputSchema.safeParse(ok).success);
  t("negative price rejected", !pl.planInputSchema.safeParse({ ...ok, monthlyPrice: -100 }).success);
  t("fractional minor units rejected", !pl.planInputSchema.safeParse({ ...ok, monthlyPrice: 499.5 }).success);
  t("below Razorpay minimum rejected", !pl.planInputSchema.safeParse({ ...ok, monthlyPrice: 50 }).success);
  t("unknown currency rejected", !pl.planInputSchema.safeParse({ ...ok, currency: "XYZ" }).success);
  t("bad identifier rejected", !pl.planInputSchema.safeParse({ ...ok, id: "Team Plan!" }).success);
  t("Free plan can't have a price", !pl.planInputSchema.safeParse({ ...ok, id: "free", monthlyPrice: 100 }).success);
  t("negative limits rejected", !pl.planInputSchema.safeParse({ ...ok, limits: { ...ok.limits, dynamic: -1 } }).success);
  t("unknown export format rejected", !pl.planInputSchema.safeParse({ ...ok, limits: { ...ok.limits, exports: ["exe"] } }).success);
  const row = { id: "x", name: "X", description: "", currency: "INR", monthlyPrice: 0, annualPrice: 0, features: "not json", limits: "{\"dynamic\":-5}", featured: false, status: "weird", sortOrder: 0 };
  const parsed = pl.planFromRow(row);
  t("corrupt stored plan falls back to safe values", parsed.features.length === 0 && parsed.limits.dynamic >= 0 && parsed.status === "draft");
}

section("Branding validation");
{
  const br = await import("../src/lib/branding");
  const base = { ...br.BRAND_DEFAULTS };
  t("defaults are valid", br.brandingSchema.safeParse(base).success);
  t("markup in the title rejected", !br.brandingSchema.safeParse({ ...base, siteTitle: "<script>alert(1)</script>" }).success);
  t("markup in the brand name rejected", !br.brandingSchema.safeParse({ ...base, brandName: "</title><img src=x onerror=1>" }).success);
  t("control characters rejected", !br.brandingSchema.safeParse({ ...base, brandName: "A\u0000B" }).success);
  t("title template must contain %s", !br.brandingSchema.safeParse({ ...base, titleTemplate: "QRSathi" }).success);
  t("colours must be #rrggbb", !br.brandingSchema.safeParse({ ...base, primaryColor: "red;}body{display:none" }).success && !br.brandingSchema.safeParse({ ...base, accentColor: "#12345" }).success);
  t("asset names must be generated names", !br.brandingSchema.safeParse({ ...base, logo: "../../etc/passwd" }).success && !br.brandingSchema.safeParse({ ...base, logo: "https://evil.example/x.png" }).success);
  const soc = (social: Record<string, string>) => br.brandingSchema.safeParse({ ...base, social: { ...base.social, ...social } }).success;
  t("social links default to empty (hidden)", br.socialLinks(br.BRAND_DEFAULTS).length === 0 && Object.values(br.BRAND_DEFAULTS.social).every((v) => v === ""));
  t("social link on the network's own host accepted", soc({ instagram: "https://www.instagram.com/brand", x: "https://twitter.com/brand", whatsapp: "https://wa.me/919876543210" }));
  t("social link on another host rejected", !soc({ instagram: "https://instagram.com.evil.io/brand" }) && !soc({ facebook: "https://evil.example/facebook.com" }));
  t("social links must be https without credentials", !soc({ github: "http://github.com/org" }) && !soc({ youtube: "javascript:alert(1)//youtube.com" }) && !soc({ linkedin: "https://u:p@linkedin.com/in/x" }));
  t("socialLinks lists only configured networks", JSON.stringify(br.socialLinks({ social: { ...base.social, telegram: "https://t.me/brand" } }).map((l) => l.id)) === '["telegram"]');
  t("invalid stored fields fall back to defaults", br.sanitizeBranding({ brandName: "<b>", primaryColor: "#000000" }).brandName === br.BRAND_DEFAULTS.brandName && br.sanitizeBranding({ primaryColor: "#000000" }).primaryColor === "#000000");
  t("theme CSS contains only colour values", /^:root\{--brand:\d+ \d+% \d+%;--brand-fg:\d+ \d+% \d+%;--accent:\d+ \d+% \d+%\}$/.test(br.themeCss(base)));
  t("button text picks a readable colour", br.onColor("#ffff00") === "#09090b" && br.onColor("#1e1b4b") === "#ffffff");
  t("hex ↔ hsl round trip", br.hslTripletToHex(br.hexToHslTriplet("#3b3fd8")).length === 7);
}

section("Image upload validation");
{
  const ic = await import("../src/lib/image-check");
  const png = (w: number, h: number) => { const b = Buffer.alloc(33); Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").copy(b); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  const jpg = (w: number, h: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = (w: number, h: number) => { const b = Buffer.alloc(30); b.write("RIFF", 0); b.write("WEBP", 8); b.write("VP8X", 12); b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };
  const info = (b: Buffer, ext: string) => ic.inspectImage(b, ext) as any;
  t("PNG dimensions", info(png(400, 120), "png").width === 400 && info(png(400, 120), "png").height === 120);
  t("JPEG dimensions", info(jpg(1200, 630), "jpg").width === 1200 && info(jpg(1200, 630), "jpeg").height === 630);
  t("WebP dimensions", info(webp(512, 512), "webp").width === 512);
  t("content must match the extension", "error" in info(png(10, 10), "jpg") && "error" in info(Buffer.from("<html>"), "png"));
  t("unsupported types rejected (gif, ico, html)", ["gif", "ico", "html"].every((e) => "error" in info(png(10, 10), e)));
  const svg = (s: string) => info(Buffer.from(s), "svg");
  t("plain SVG accepted with viewBox size", svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><path d="M0 0h10v10z" fill="url(#g)"/></svg>`).width === 120);
  for (const [name, s] of [
    ["script", `<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>`], ["onload", `<svg viewBox="0 0 1 1" onload="alert(1)"/>`],
    ["javascript: link", `<svg viewBox="0 0 1 1"><a href="javascript:alert(1)">x</a></svg>`], ["external image", `<svg viewBox="0 0 1 1"><image href="https://evil/x.png"/></svg>`],
    ["foreignObject", `<svg viewBox="0 0 1 1"><foreignObject><iframe/></foreignObject></svg>`], ["entity", `<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 1 1"/>`],
    ["external CSS", `<svg viewBox="0 0 1 1"><style>@import url(https://evil/x.css)</style></svg>`], ["data URL", `<svg viewBox="0 0 1 1"><image href="data:text/html,x"/></svg>`],
  ] as const) t(`malicious SVG rejected: ${name}`, "error" in svg(s));
  t("favicon must be square", ic.checkAssetRules("favicon", 1000, info(png(400, 120), "png")) !== null && ic.checkAssetRules("favicon", 1000, info(png(512, 512), "png")) === null);
  t("oversized logo rejected", ic.checkAssetRules("logo", 2 * 1024 * 1024, info(png(400, 120), "png")) !== null);
  t("tiny / huge dimensions rejected", ic.checkAssetRules("logo", 1000, info(png(8, 8), "png")) !== null && ic.checkAssetRules("logo", 1000, info(png(9000, 900), "png")) !== null);
  t("SVG social image rejected", ic.checkAssetRules("ogImage", 1000, svg(`<svg viewBox="0 0 1200 630"/>`)) !== null);
}

section("Billing configuration rules (env-check)");
t("malformed RAZORPAY_KEY_ID fails", checkEnv({ ...prodBase, RAZORPAY_KEY_ID: "abc", RAZORPAY_KEY_SECRET: "x", RAZORPAY_WEBHOOK_SECRET: "y" }).errors.some((e) => /RAZORPAY_KEY_ID/.test(e)));
t("short SETTINGS_ENCRYPTION_KEY fails", checkEnv({ ...prodBase, SETTINGS_ENCRYPTION_KEY: "short" }).errors.length > 0);
t("SETTINGS_ENCRYPTION_KEY equal to AUTH_SECRET fails", checkEnv({ ...prodBase, SETTINGS_ENCRYPTION_KEY: prodBase.AUTH_SECRET }).errors.length > 0);
// Policy change (remediation 2026-10-26): the test-only override now refuses to start on a public origin.
t("RAZORPAY_API_BASE override refuses to start on a public production origin", checkEnv({ ...prodBase, RAZORPAY_API_BASE: "http://127.0.0.1:9" }).errors.some((e) => /RAZORPAY_API_BASE/.test(e)));
t("RAZORPAY_API_BASE override only warns for a localhost production test server", (() => { const r = checkEnv({ ...prodBase, NEXT_PUBLIC_APP_URL: "http://localhost:3100", RAZORPAY_API_BASE: "http://127.0.0.1:9" }); return !r.errors.length && r.warnings.some((w) => /RAZORPAY_API_BASE/.test(w)); })());
t("the real Razorpay API base is accepted", checkEnv({ ...prodBase, RAZORPAY_API_BASE: "https://api.razorpay.com" }).errors.length === 0);
t("missing SMTP refuses to start on a public production origin", checkEnv({ ...prodBase, SMTP_HOST: "" }).errors.some((e) => /SMTP/.test(e)));
t("MAIL_DISABLED=true accepts running without e-mail (warning only)", (() => { const r = checkEnv({ ...prodBase, SMTP_HOST: "", MAIL_DISABLED: "true" }); return !r.errors.length && r.warnings.some((w) => /SMTP/.test(w)); })());
t("SQLite refuses to start on a public production origin", checkEnv({ ...prodBase, DATABASE_URL: "file:./prod.db" }).errors.some((e) => /SQLite/.test(e)));
t("ALLOW_SQLITE_IN_PRODUCTION=true accepts SQLite (warning only)", (() => { const r = checkEnv({ ...prodBase, DATABASE_URL: "file:./prod.db", ALLOW_SQLITE_IN_PRODUCTION: "true" }); return !r.errors.length && r.warnings.some((w) => /SQLite/.test(w)); })());
t("unsupported database scheme (e.g. postgres://) refuses to start", checkEnv({ ...prodBase, DATABASE_URL: "postgres://u:p@h/db" }).errors.some((e) => /DATABASE_URL/.test(e)));
t("error messages never echo secret values", (() => { const r = checkEnv({ ...prodBase, AUTH_SECRET: "short-but-secret-value", DATABASE_URL: "postgres://user:hunter2@h/db" }); return !JSON.stringify(r).includes("hunter2") && !JSON.stringify(r).includes("short-but-secret-value"); })());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
