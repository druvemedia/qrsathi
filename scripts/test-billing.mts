/**
 * Billing, pricing, branding and entitlement integration tests against a running
 * production build. Razorpay is replaced by a deterministic MOCK server started by
 * this script — nothing here talks to the real Razorpay.
 *
 * Start the app with (in addition to the usual test variables):
 *   RAZORPAY_API_BASE=http://127.0.0.1:3999  SETTINGS_ENCRYPTION_KEY=<32+ chars>
 *   and NO RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET.
 * Then:
 *   BASE_URL=http://localhost:3100 DATABASE_URL=file:/abs/test.db npm run test:billing
 *
 * NEVER point this at a production database: it creates/deletes accounts and plans.
 */
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { currentStep, totpAt } from "../src/lib/mfa";
import { hexToHslTriplet } from "../src/lib/branding";

const BASE = (process.env.BASE_URL || "http://localhost:3100").replace(/\/$/, "");
const MOCK_PORT = Number(process.env.MOCK_PORT || 3999);
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the test server's database.");
const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const RUN = randomBytes(3).toString("hex");
const IP = `10.88.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

let pass = 0, fail = 0;
const check = (name: string, cond: unknown, info: unknown = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond ? `  → ${typeof info === "string" ? info : JSON.stringify(info)?.slice(0, 400)}` : ""}`);
};
const section = (s: string) => console.log(`\n# ${s}`);

// ---------- mock Razorpay ----------
const GOOD = { keyId: `rzp_test_Good${RUN}Key1`, keySecret: `GoodSecret${RUN}abcdefgh` };
const LIVE_BAD = { keyId: `rzp_live_Bad${RUN}Key12`, keySecret: `BadSecret${RUN}abcdefghi` };
const WEBHOOK = `whsec_test_${RUN}_secret`;
const mock = {
  plans: new Map<string, any>(), subs: new Map<string, any>(), payments: new Map<string, any>(), calls: [] as string[],
};
const rid = (p: string) => `${p}_${randomBytes(7).toString("hex")}`;
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (status: number, data: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    const auth = Buffer.from(String(req.headers.authorization || "").replace(/^Basic /, ""), "base64").toString();
    mock.calls.push(`${req.method} ${req.url}`);
    if (auth !== `${GOOD.keyId}:${GOOD.keySecret}`) return send(401, { error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } });
    const url = new URL(req.url!, "http://x");
    const json = body ? JSON.parse(body) : {};
    if (req.method === "GET" && url.pathname === "/v1/plans") return send(200, { entity: "collection", count: 0, items: [] });
    if (req.method === "POST" && url.pathname === "/v1/plans") { const p = { id: rid("plan"), period: json.period, interval: json.interval, item: json.item, notes: json.notes }; mock.plans.set(p.id, p); return send(200, p); }
    if (req.method === "POST" && url.pathname === "/v1/subscriptions") {
      if (!mock.plans.has(json.plan_id)) return send(400, { error: { description: "Invalid plan" } });
      const s = { id: rid("sub"), plan_id: json.plan_id, status: "created", notes: json.notes, current_start: null, current_end: null, total_count: json.total_count };
      mock.subs.set(s.id, s); return send(200, s);
    }
    let m = /^\/v1\/subscriptions\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && m) return mock.subs.has(m[1]) ? send(200, mock.subs.get(m[1])) : send(404, { error: { description: "not found" } });
    m = /^\/v1\/subscriptions\/([^/]+)\/cancel$/.exec(url.pathname);
    if (req.method === "POST" && m) { const s = mock.subs.get(m[1]); if (!s) return send(404, {}); if (!json.cancel_at_cycle_end) s.status = "cancelled"; return send(200, s); }
    m = /^\/v1\/payments\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && m) return mock.payments.has(m[1]) ? send(200, mock.payments.get(m[1])) : send(404, { error: { description: "not found" } });
    send(404, { error: { description: "unknown route" } });
  });
});
await new Promise<void>((r) => server.listen(MOCK_PORT, "127.0.0.1", r));

// ---------- HTTP helpers ----------
type Jar = Record<string, string>;
const cookieHeader = (jar?: Jar) => (jar ? Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") : "");
function absorb(jar: Jar, res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const [kv] = c.split(";"); const i = kv.indexOf("=");
    const k = kv.slice(0, i), v = kv.slice(i + 1);
    if (!v || /max-age=0/i.test(c)) delete jar[k]; else jar[k] = v;
  }
}
// Keep-alive sockets closed by the server while the test was busy (e.g. running the CLI) can surface
// as ECONNRESET on reuse; retry such requests once on a fresh connection.
async function fetchRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e: any) {
    if (e?.cause?.code !== "ECONNRESET" && e?.cause?.code !== "UND_ERR_SOCKET") throw e;
    return fetch(url, init);
  }
}
async function call(method: string, p: string, body?: unknown, jar?: Jar, extra: Record<string, string> = {}) {
  const res = await fetchRetry(BASE + p, { method, redirect: "manual", headers: { Origin: BASE, "X-Forwarded-For": IP, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(jar ? { Cookie: cookieHeader(jar) } : {}), ...extra }, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (jar) absorb(jar, res);
  const text = await res.text(); let data: any = text; try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, text, headers: res.headers };
}
const cli = (args: string[], password: string) => spawnSync("npx", ["tsx", "scripts/admin.mts", ...args, "--password-stdin"], { input: password + "\n", encoding: "utf8", env: process.env, shell: process.platform === "win32" });
const email = (t: string) => `b-${t}-${RUN}@example.com`;
const created: string[] = [];
async function signup(tag: string) {
  const jar: Jar = {};
  const r = await call("POST", "/api/auth/signup", { name: `B ${tag}`, email: email(tag), password: "testpass123", acceptTerms: true }, jar);
  created.push(email(tag));
  return { jar, id: r.data.user?.id as string, email: email(tag) };
}
function hook(body: unknown, opts: { secret?: string; eventId?: string } = {}) {
  const raw = JSON.stringify(body);
  return fetch(BASE + "/api/billing/webhook", { method: "POST", headers: { "Content-Type": "application/json", "X-Razorpay-Signature": createHmac("sha256", opts.secret ?? WEBHOOK).update(raw).digest("hex"), "X-Razorpay-Event-Id": opts.eventId ?? rid("evt") }, body: raw });
}
const charged = (sub: any, pay: any) => ({ event: "subscription.charged", payload: { subscription: { entity: sub }, payment: { entity: pay } } });
const secretsLeaked = (s: string) => [GOOD.keySecret, LIVE_BAD.keySecret, WEBHOOK].some((x) => s.includes(x));
const SECRET_STRINGS = () => [GOOD.keySecret, LIVE_BAD.keySecret, WEBHOOK];

// Payment-config + plan state is restored at the end so the test database stays usable.
const settingKeys = ["payments.razorpay", "payments.razorpay.lastWebhook.test", "payments.razorpay.lastWebhook.live", "branding.published", "branding.draft"];
const savedSettings = await db.setting.findMany({ where: { key: { in: settingKeys } } });
const savedPlans = await db.pricingPlan.findMany();
const savedProviderPlans = new Set((await db.providerPlan.findMany({ select: { id: true } })).map((p) => p.id));

console.log(`Testing ${BASE} with mock Razorpay on :${MOCK_PORT} (run ${RUN})`);
try {
  section("Setup: super administrator with MFA");
  const SUPER = email("super"), ADMIN = email("admin");
  created.push(SUPER, ADMIN);
  check("super admin created", cli(["create", "--email", SUPER, "--super"], "Billing-Super-Pass-7q").status === 0);
  check("admin created", cli(["create", "--email", ADMIN], "Billing-Staff-Pass-8w").status === 0);
  const S: Jar = {};
  await call("POST", "/api/admin/auth/login", { email: SUPER, password: "Billing-Super-Pass-7q" }, S);
  const setup = await call("POST", "/api/admin/mfa", { action: "setup" }, S);
  const secret = setup.data.secret;
  const en = await call("POST", "/api/admin/mfa", { action: "enable", code: totpAt(secret, currentStep()) }, S);
  check("super admin enrolled in MFA", en.status === 200, en.data);
  const A: Jar = {};
  await call("POST", "/api/admin/auth/login", { email: ADMIN, password: "Billing-Staff-Pass-8w" }, A);
  // Start from a clean, unconfigured gateway.
  await db.setting.deleteMany({ where: { key: { in: settingKeys.slice(0, 3) } } });

  section("Payment gateway: credentials never leave the server");
  let st = await call("GET", "/api/admin/payments/config", undefined, S);
  check("initial status: missing, checkout off", st.status === 200 && st.data.test.status === "missing" && st.data.enabled === false && st.data.storageAvailable === true, st.data);
  check("ordinary admin can read status but not change credentials (403)", (await call("GET", "/api/admin/payments/config", undefined, A)).status === 200 && (await call("PUT", "/api/admin/payments/config", { mode: "test", keyId: GOOD.keyId }, A)).status === 403);
  const u0 = await signup("nosy");
  check("customers can't read gateway settings (401)", (await call("GET", "/api/admin/payments/config", undefined, u0.jar)).status === 401);
  const wrongMode = await call("PUT", "/api/admin/payments/config", { mode: "test", keyId: LIVE_BAD.keyId }, S);
  check("a live key can't be saved as test credentials (400)", wrongMode.status === 400 && /live key/.test(wrongMode.data.error), wrongMode.data);
  const save1 = await call("PUT", "/api/admin/payments/config", { mode: "test", keyId: GOOD.keyId, keySecret: "WrongSecret1234567890", webhookSecret: WEBHOOK }, S);
  check("test credentials saved", save1.status === 200 && save1.data.changed?.includes("keySecret"), save1.data);
  check("save response contains no secret", !secretsLeaked(save1.text) && !save1.text.includes("WrongSecret1234567890"));
  st = await call("GET", "/api/admin/payments/config", undefined, S);
  check("GET shows only 'configured' flags", st.data.test.keySecretConfigured === true && st.data.test.webhookSecretConfigured === true && !secretsLeaked(st.text) && !st.text.includes("WrongSecret"), st.data.test);
  const row = await db.setting.findUnique({ where: { key: "payments.razorpay" } });
  check("secrets are encrypted at rest", !!row && !row.value.includes("WrongSecret1234567890") && !row.value.includes(WEBHOOK) && row.value.includes("sb1:"));
  check("enabling with unverified credentials refused (400)", (await call("PATCH", "/api/admin/payments/config", { enabled: true }, S)).status === 400);
  const bad = await call("POST", "/api/admin/payments/config", { action: "verify", mode: "test" }, S);
  check("test connection with a wrong secret → invalid (not 'verified')", bad.data.status === "invalid" && bad.data.status !== "verified", bad.data);
  check("invalid credentials still can't enable checkout", (await call("PATCH", "/api/admin/payments/config", { enabled: true }, S)).status === 400);
  await call("PUT", "/api/admin/payments/config", { mode: "test", keySecret: GOOD.keySecret }, S);
  const good = await call("POST", "/api/admin/payments/config", { action: "verify", mode: "test" }, S);
  check("test connection with valid credentials → verified (read-only call)", good.data.status === "verified" && mock.calls.some((c) => c.startsWith("GET /v1/plans")) && !mock.calls.some((c) => c.startsWith("POST")), { r: good.data, calls: mock.calls });
  check("webhook secret reported as not remotely verifiable", /can't be checked/.test(good.data.webhookNote || ""), good.data.webhookNote);
  const enable = await call("PATCH", "/api/admin/payments/config", { enabled: true }, S);
  check("checkout enabled after verification", enable.status === 200 && enable.data.status.checkoutReady === true, enable.data);
  await call("PUT", "/api/admin/payments/config", { mode: "live", keyId: LIVE_BAD.keyId, keySecret: LIVE_BAD.keySecret, webhookSecret: "whsec_live_xyz12345" }, S);
  const liveV = await call("POST", "/api/admin/payments/config", { action: "verify", mode: "live" }, S);
  check("invalid live credentials → invalid", liveV.data.status === "invalid", liveV.data);
  check("invalid live credentials can't enable live billing (400)", (await call("PATCH", "/api/admin/payments/config", { mode: "live", enabled: true }, S)).status === 400);
  check("checkout stays in test mode", (await call("GET", "/api/admin/payments/config", undefined, S)).data.mode === "test");

  section("Recent re-authentication for credential changes");
  const sess = await db.session.findMany({ where: { user: { email: SUPER }, kind: "admin" } });
  await db.session.updateMany({ where: { id: { in: sess.map((x) => x.id) } }, data: { createdAt: new Date(Date.now() - 3600_000), reauthAt: null } });
  const stale = await call("PUT", "/api/admin/payments/config", { mode: "test", webhookSecret: WEBHOOK }, S);
  check("stale admin session must re-authenticate (403 reauthRequired)", stale.status === 403 && stale.data.details?.reauthRequired === true, stale.data);
  check("re-auth with wrong password refused", (await call("POST", "/api/admin/auth/reauth", { password: "nope-nope", code: totpAt(secret, currentStep() + 1) }, S)).status === 401);
  const ra = await call("POST", "/api/admin/auth/reauth", { password: "Billing-Super-Pass-7q", code: totpAt(secret, currentStep() + 1) }, S);
  check("re-auth with password + 2FA code succeeds", ra.status === 200, ra.data);
  check("credential change allowed after re-auth", (await call("PUT", "/api/admin/payments/config", { mode: "test", webhookSecret: WEBHOOK }, S)).status === 200);
  // Credential change disabled checkout? (webhook secret only → stays enabled)
  check("changing only the webhook secret keeps checkout verified", (await call("GET", "/api/admin/payments/config", undefined, S)).data.checkoutReady === true);

  section("Pricing administration");
  const plans0 = await call("GET", "/api/admin/plans", undefined, A);
  check("default plans seeded (free, pro, business)", ["free", "pro", "business"].every((id) => plans0.data.plans?.some((p: any) => p.id === id)), plans0.data);
  const base = { id: `team${RUN}`, name: "Team", description: "For small teams", currency: "INR", monthlyPrice: 49900, annualPrice: 499000, features: ["Shared workspace"], limits: plans0.data.plans.find((p: any) => p.id === "pro").limits, featured: false, sortOrder: 9 };
  check("ordinary admin can't create plans (403)", (await call("POST", "/api/admin/plans", base, A)).status === 403);
  check("negative price rejected", (await call("POST", "/api/admin/plans", { ...base, monthlyPrice: -1 }, S)).status === 400);
  check("fractional minor units rejected", (await call("POST", "/api/admin/plans", { ...base, monthlyPrice: 499.5 }, S)).status === 400);
  check("unknown currency rejected", (await call("POST", "/api/admin/plans", { ...base, currency: "XYZ" }, S)).status === 400);
  check("invalid limits rejected", (await call("POST", "/api/admin/plans", { ...base, limits: { ...base.limits, products: -5 } }, S)).status === 400);
  check("plan created as draft", (await call("POST", "/api/admin/plans", base, S)).status === 201 && (await db.pricingPlan.findUnique({ where: { id: base.id } }))?.status === "draft");
  check("duplicate identifier rejected (409)", (await call("POST", "/api/admin/plans", base, S)).status === 409);
  let pricingHtml = await (await fetch(BASE + "/pricing")).text();
  check("draft plan hidden from the public pricing page", !pricingHtml.includes(`>Team<`));
  check("publish", (await call("POST", `/api/admin/plans/${base.id}`, { action: "publish" }, S)).status === 200);
  pricingHtml = await (await fetch(BASE + "/pricing")).text();
  check("published plan rendered from the database with its real price", pricingHtml.includes("Team") && pricingHtml.includes("₹499"), pricingHtml.slice(0, 200));
  const dup = await call("POST", `/api/admin/plans/${base.id}`, { action: "duplicate" }, S);
  check("duplicate creates a draft copy", dup.status === 201 && (await db.pricingPlan.findUnique({ where: { id: dup.data.id } }))?.status === "draft", dup.data);
  check("edit plan", (await call("PATCH", `/api/admin/plans/${base.id}`, { plan: { ...base, name: "Team Plus", monthlyPrice: 59900 } }, S)).data.providerSyncRequired === true);
  check("unpublish hides it again", (await call("POST", `/api/admin/plans/${base.id}`, { action: "unpublish" }, S)).status === 200 && !(await (await fetch(BASE + "/pricing")).text()).includes("Team Plus"));
  check("archive", (await call("POST", `/api/admin/plans/${dup.data.id}`, { action: "archive" }, S)).status === 200);
  check("Free plan can't be archived or unpublished", (await call("POST", "/api/admin/plans/free", { action: "archive" }, S)).status === 400 && (await call("POST", "/api/admin/plans/free", { action: "unpublish" }, S)).status === 400);
  const ids = (await call("GET", "/api/admin/plans", undefined, S)).data.plans.map((p: any) => p.id);
  const reordered = [ids[1], ids[0], ...ids.slice(2)];
  check("reorder", (await call("POST", "/api/admin/plans/reorder", { ids: reordered }, S)).status === 200 && (await call("GET", "/api/admin/plans", undefined, S)).data.plans[0].id === reordered[0]);
  await call("POST", "/api/admin/plans/reorder", { ids }, S);
  const proSyncBefore = (await call("GET", "/api/admin/plans", undefined, S)).data.plans.find((p: any) => p.id === "pro").sync;
  check("Pro not yet synced with Razorpay", proSyncBefore.intervals.every((i: any) => !i.synced), proSyncBefore);
  const sync = await call("POST", "/api/admin/plans/pro", { action: "sync" }, S);
  check("sync creates Razorpay plans for each interval", sync.status === 200 && sync.data.created?.length === 2 && [...mock.plans.values()].some((p) => p.item.amount === 29900 && p.period === "monthly"), sync.data);
  check("second sync is a no-op", (await call("POST", "/api/admin/plans/pro", { action: "sync" }, S)).data.created?.length === 0);

  section("Checkout: the server decides the price");
  const U = await signup("payer");
  const ss = await call("POST", "/api/billing/subscribe", { planId: "pro", interval: "month", price: 1, amount: 1, currency: "USD" }, U.jar);
  check("subscription created with the server price", ss.status === 200 && ss.data.amount === 29900 && ss.data.currency === "INR" && /^sub_/.test(ss.data.subscriptionId) && ss.data.keyId === GOOD.keyId, ss.data);
  check("checkout response has no secret", !secretsLeaked(ss.text));
  const subRow = await db.subscription.findUnique({ where: { providerSubscriptionId: ss.data.subscriptionId } });
  check("subscription recorded as 'created'; plan not changed yet", subRow?.status === "created" && (await db.user.findUnique({ where: { id: U.id } }))?.plan === "free");
  check("unpublished plan can't be bought (404)", (await call("POST", "/api/billing/subscribe", { planId: base.id, interval: "month" }, U.jar)).status === 404);
  check("unknown plan can't be bought (404)", (await call("POST", "/api/billing/subscribe", { planId: "free", interval: "month" }, U.jar)).status === 404);
  check("guests can't start checkout (401)", (await call("POST", "/api/billing/subscribe", { planId: "pro", interval: "month" })).status === 401);
  const subId = ss.data.subscriptionId;
  const pay1 = { id: rid("pay"), amount: 29900, currency: "INR", status: "captured" };
  mock.payments.set(pay1.id, pay1);
  const s1 = mock.subs.get(subId);
  s1.status = "active"; s1.current_start = Math.floor(Date.now() / 1000); s1.current_end = Math.floor(Date.now() / 1000) + 30 * 86400;
  const sig = (p: string, s: string, k = GOOD.keySecret) => createHmac("sha256", k).update(`${p}|${s}`).digest("hex");
  const forged = await call("POST", "/api/billing/verify", { razorpay_payment_id: pay1.id, razorpay_subscription_id: subId, razorpay_signature: sig(pay1.id, subId, "not-the-secret") }, U.jar);
  check("forged checkout signature rejected; plan unchanged", forged.status === 400 && (await db.user.findUnique({ where: { id: U.id } }))?.plan === "free", forged.data);
  const other = await signup("other");
  check("another user can't confirm this subscription (404)", (await call("POST", "/api/billing/verify", { razorpay_payment_id: pay1.id, razorpay_subscription_id: subId, razorpay_signature: sig(pay1.id, subId) }, other.jar)).status === 404);
  const v1 = await call("POST", "/api/billing/verify", { razorpay_payment_id: pay1.id, razorpay_subscription_id: subId, razorpay_signature: sig(pay1.id, subId) }, U.jar);
  let urow = await db.user.findUnique({ where: { id: U.id } });
  check("valid signature + captured payment (confirmed via API) → active", v1.data.status === "active" && urow?.plan === "pro", { v1: v1.data, plan: urow?.plan });
  const expiry1 = urow!.planExpiresAt!.getTime();
  check("plan runs to the provider's period end (+24 h grace)", Math.abs(expiry1 - (s1.current_end * 1000 + 86400_000)) < 2000, new Date(expiry1));
  check("me endpoint reflects Pro entitlements", (await call("GET", "/api/auth/me", undefined, U.jar)).data.user?.limits?.dynamic === 100);
  const v2 = await call("POST", "/api/billing/verify", { razorpay_payment_id: pay1.id, razorpay_subscription_id: subId, razorpay_signature: sig(pay1.id, subId) }, U.jar);
  check("repeated confirmation is idempotent", v2.data.status === "active" && (await db.payment.count({ where: { providerRef: pay1.id } })) === 1);
  const sta = await call("GET", `/api/billing/status?subscription=${subId}`, undefined, U.jar);
  check("status page reports active", sta.data.state === "active", sta.data);
  check("second subscription while active refused (409)", (await call("POST", "/api/billing/subscribe", { planId: "business", interval: "month" }, U.jar)).status === 409);

  section("Webhooks: signature, ledger, duplicates, mismatches");
  check("invalid signature rejected (400)", (await hook(charged(s1, pay1), { secret: "wrong" })).status === 400);
  const evt = rid("evt");
  const w1 = await hook(charged(s1, pay1), { eventId: evt });
  const w2 = await hook(charged(s1, pay1), { eventId: evt });
  check("duplicate delivery (same event id) is a no-op", w1.status === 200 && w2.status === 200 && (await w2.text()) === "duplicate" && (await db.payment.count({ where: { providerRef: pay1.id } })) === 1);
  const w3 = await hook(charged(s1, pay1));
  check("same payment under a new event id doesn't record twice or extend the plan", w3.status === 200 && (await db.payment.count({ where: { providerRef: pay1.id } })) === 1 && (await db.user.findUnique({ where: { id: U.id } }))!.planExpiresAt!.getTime() === expiry1);
  const burst = await Promise.all([1, 2, 3, 4].map(() => hook(charged(s1, { ...pay1 }))));
  check("concurrent duplicate deliveries record one payment", burst.every((r) => r.status === 200) && (await db.payment.count({ where: { providerRef: pay1.id } })) === 1);
  check("ledger stores events without raw payloads", (await db.webhookEvent.findMany({ where: { eventId: evt } })).every((e) => !e.summary.includes("captured") && e.summary.length < 200));
  const cheap = { id: rid("pay"), amount: 100, currency: "INR", status: "captured" };
  const wm = await hook(charged({ ...s1, current_end: s1.current_end + 30 * 86400 }, cheap));
  check("amount mismatch rejected: nothing recorded, plan not extended", wm.status === 200 && (await wm.text()) === "rejected" && (await db.payment.count({ where: { providerRef: cheap.id } })) === 0 && (await db.user.findUnique({ where: { id: U.id } }))!.planExpiresAt!.getTime() === expiry1);
  const usd = { id: rid("pay"), amount: 29900, currency: "USD", status: "captured" };
  check("currency mismatch rejected", (await (await hook(charged({ ...s1, current_end: s1.current_end + 30 * 86400 }, usd))).text()) === "rejected" && (await db.payment.count({ where: { providerRef: usd.id } })) === 0);
  check("plan mismatch rejected", (await (await hook(charged({ ...s1, plan_id: "plan_other" }, { id: rid("pay"), amount: 29900, currency: "INR", status: "captured" }))).text()) === "rejected");
  check("unknown subscription ignored", (await (await hook(charged({ ...s1, id: "sub_unknown123" }, { id: rid("pay"), amount: 29900, currency: "INR", status: "captured" }))).text()) === "ignored");
  const crossMode = await (await hook(charged(s1, { id: rid("pay"), amount: 29900, currency: "INR", status: "captured" }), { secret: "whsec_live_xyz12345" })).text();
  check("events signed with the other mode's secret are rejected for test subscriptions", crossMode === "rejected", crossMode);

  section("Renewal, failure, halt, cancellation, refund");
  const pay2 = { id: rid("pay"), amount: 29900, currency: "INR", status: "captured" };
  const renewedEnd = s1.current_end + 30 * 86400;
  await hook(charged({ ...s1, current_end: renewedEnd }, pay2));
  urow = await db.user.findUnique({ where: { id: U.id } });
  check("renewal charge extends to the new period end", Math.abs(urow!.planExpiresAt!.getTime() - (renewedEnd * 1000 + 86400_000)) < 2000 && (await db.payment.count({ where: { subscriptionId: subRow!.id, status: "paid" } })) === 2);
  await hook({ event: "subscription.pending", payload: { subscription: { entity: { ...s1, status: "pending" } } } });
  check("pending renewal → status pending, plan kept", (await db.subscription.findUnique({ where: { id: subRow!.id } }))?.status === "pending" && (await db.user.findUnique({ where: { id: U.id } }))?.plan === "pro");
  await hook({ event: "subscription.halted", payload: { subscription: { entity: { ...s1, status: "halted" } } } });
  const halted = await db.user.findUnique({ where: { id: U.id } });
  check("halted → paid access ends now", halted!.planExpiresAt!.getTime() <= Date.now() + 1000);
  check("after halt the session falls back to Free", (await call("GET", "/api/auth/me", undefined, U.jar)).data.user?.plan === "free");

  const F = await signup("failer");
  const fs1 = await call("POST", "/api/billing/subscribe", { planId: "pro", interval: "year" }, F.jar);
  const failPay = { id: rid("pay"), amount: 299000, currency: "INR", status: "failed", error_description: "Card declined by bank" };
  mock.payments.set(failPay.id, failPay);
  const fr = await call("POST", "/api/billing/verify", { razorpay_payment_id: failPay.id, razorpay_subscription_id: fs1.data.subscriptionId, razorpay_signature: sig(failPay.id, fs1.data.subscriptionId) }, F.jar);
  check("failed payment → 'failed', plan unchanged, failure recorded", fr.data.status === "failed" && (await db.user.findUnique({ where: { id: F.id } }))?.plan === "free" && (await db.payment.findUnique({ where: { providerRef: failPay.id } }))?.status === "failed", fr.data);
  check("status page explains the failure", (await call("GET", `/api/billing/status?subscription=${fs1.data.subscriptionId}`, undefined, F.jar)).data.state === "failed");

  const P = await signup("pending");
  const ps = await call("POST", "/api/billing/subscribe", { planId: "pro", interval: "month" }, P.jar);
  const authPay = { id: rid("pay"), amount: 29900, currency: "INR", status: "authorized" };
  mock.payments.set(authPay.id, authPay);
  const pr = await call("POST", "/api/billing/verify", { razorpay_payment_id: authPay.id, razorpay_subscription_id: ps.data.subscriptionId, razorpay_signature: sig(authPay.id, ps.data.subscriptionId) }, P.jar);
  check("returning from checkout without a captured payment stays pending (no activation)", pr.data.status === "pending" && (await db.user.findUnique({ where: { id: P.id } }))?.plan === "free", pr.data);
  check("status page shows pending, not success", (await call("GET", `/api/billing/status?subscription=${ps.data.subscriptionId}`, undefined, P.jar)).data.state === "pending");
  const ps1 = mock.subs.get(ps.data.subscriptionId); ps1.status = "active"; ps1.current_end = Math.floor(Date.now() / 1000) + 30 * 86400;
  await hook(charged(ps1, { ...authPay, status: "captured" }));
  check("…and activates when the signed webhook confirms the capture", (await db.user.findUnique({ where: { id: P.id } }))?.plan === "pro");

  const cancelResp = await call("POST", "/api/billing/cancel", {}, P.jar);
  check("cancel at period end: Razorpay asked, plan kept", cancelResp.status === 200 && cancelResp.data.cancelAtPeriodEnd === true && (await db.user.findUnique({ where: { id: P.id } }))?.plan === "pro" && mock.calls.some((c) => c.includes("/cancel")), cancelResp.data);
  await hook({ event: "subscription.cancelled", payload: { subscription: { entity: { ...ps1, status: "cancelled" } } } });
  check("cancelled webhook → status cancelled; access until period end", (await db.subscription.findUnique({ where: { providerSubscriptionId: ps.data.subscriptionId } }))?.status === "cancelled" && (await db.user.findUnique({ where: { id: P.id } }))!.planExpiresAt!.getTime() > Date.now());
  const pPay = await db.payment.findUnique({ where: { providerRef: authPay.id } });
  await hook({ event: "refund.processed", payload: { refund: { entity: { id: rid("rfnd"), payment_id: authPay.id, amount: 10000 } }, payment: { entity: { id: authPay.id, amount: 29900, amount_refunded: 10000 } } } });
  check("partial refund recorded, access kept", (await db.payment.findUnique({ where: { id: pPay!.id } }))?.status === "partially_refunded" && (await db.user.findUnique({ where: { id: P.id } }))!.planExpiresAt!.getTime() > Date.now());
  const refundEvt = { event: "refund.processed", payload: { refund: { entity: { id: rid("rfnd"), payment_id: authPay.id, amount: 19900 } }, payment: { entity: { id: authPay.id, amount: 29900, amount_refunded: 29900 } } } };
  await hook(refundEvt); await hook(refundEvt);
  const refunded = await db.payment.findUnique({ where: { id: pPay!.id } });
  check("full refund (delivered twice) recorded once, access ends", refunded?.status === "refunded" && refunded.refundedAmount === 29900 && (await db.user.findUnique({ where: { id: P.id } }))!.planExpiresAt!.getTime() <= Date.now() + 1000);
  const hist = await call("GET", "/api/billing", undefined, P.jar);
  check("customer sees own payment history only", hist.data.payments?.length >= 1 && hist.data.payments.every((p: any) => !("userId" in p)) && !secretsLeaked(hist.text));

  section("Price changes and archived plans keep history intact");
  const Q = await signup("loyal");
  const qs = await call("POST", "/api/billing/subscribe", { planId: "pro", interval: "month" }, Q.jar);
  const qsub = mock.subs.get(qs.data.subscriptionId); qsub.status = "active"; qsub.current_end = Math.floor(Date.now() / 1000) + 30 * 86400;
  const qpay = { id: rid("pay"), amount: 29900, currency: "INR", status: "captured" };
  await hook(charged(qsub, qpay));
  const proPlan = (await call("GET", "/api/admin/plans", undefined, S)).data.plans.find((p: any) => p.id === "pro");
  const { users: _u, liveSubscriptions: _l, sync: _s, status: _st, updatedAt: _up, ...proInput } = proPlan;
  const unconfirmed = await call("PATCH", "/api/admin/plans/pro", { plan: { ...proInput, monthlyPrice: 39900 } }, S);
  check("price change with active subscribers needs confirmation (409)", unconfirmed.status === 409 && unconfirmed.data.details?.requiresConfirmation === true, unconfirmed.data);
  check("confirmed price change saved", (await call("PATCH", "/api/admin/plans/pro", { plan: { ...proInput, monthlyPrice: 39900 }, confirm: true }, S)).status === 200);
  check("existing subscription keeps its recorded price", (await db.subscription.findUnique({ where: { providerSubscriptionId: qs.data.subscriptionId } }))?.amount === 29900);
  check("payment history amounts unchanged", (await db.payment.findUnique({ where: { providerRef: qpay.id } }))?.amount === 29900);
  const proSync = (await call("GET", "/api/admin/plans", undefined, S)).data.plans.find((p: any) => p.id === "pro").sync;
  check("new price shows as not yet synced", proSync.intervals.find((i: any) => i.interval === "month")?.synced === false, proSync);
  const R = await signup("newprice");
  check("checkout refuses until the new price is synced (409)", (await call("POST", "/api/billing/subscribe", { planId: "pro", interval: "month" }, R.jar)).status === 409);
  await call("POST", "/api/admin/plans/pro", { action: "sync" }, S);
  const rs = await call("POST", "/api/billing/subscribe", { planId: "pro", interval: "month" }, R.jar);
  check("after sync, new subscribers get the new price", rs.data.amount === 39900, rs.data);
  const qRenew = { id: rid("pay"), amount: 29900, currency: "INR", status: "captured" };
  await hook(charged({ ...qsub, current_end: qsub.current_end + 30 * 86400 }, qRenew));
  check("old subscribers still renew at their original price", (await db.payment.findUnique({ where: { providerRef: qRenew.id } }))?.status === "paid");
  const arch = await call("POST", "/api/admin/plans/pro", { action: "archive" }, S);
  check("archiving a plan with subscribers needs confirmation (409)", arch.status === 409);
  check("archive confirmed", (await call("POST", "/api/admin/plans/pro", { action: "archive", confirm: true }, S)).status === 200);
  check("archived plan disappears from the pricing page and checkout", !(await (await fetch(BASE + "/pricing")).text()).includes(">Pro<") && (await call("POST", "/api/billing/subscribe", { planId: "pro", interval: "month" }, (await signup("late")).jar)).status === 404);
  check("existing subscriber keeps archived plan's entitlements", (await call("GET", "/api/auth/me", undefined, Q.jar)).data.user?.limits?.dynamic === 100);
  await call("POST", "/api/admin/plans/pro", { action: "restore" }, S);
  await call("POST", "/api/admin/plans/pro", { action: "publish" }, S);

  section("Server-side entitlements");
  const E = await signup("quota");
  const qr = (i: number, extra: Record<string, unknown> = {}) => call("POST", "/api/qrcodes", { name: `Q${i}`, type: "dynamic", content: { url: `https://example.com/${i}` }, design: {}, ...extra }, E.jar);
  for (let i = 0; i < 4; i++) await qr(i);
  const race = await Promise.all(Array.from({ length: 8 }, (_, i) => qr(100 + i)));
  const ok = race.filter((r) => r.status === 201).length;
  const dyn = await db.qrCode.count({ where: { user: { email: E.email }, isDynamic: true, isHosted: false } });
  check("concurrent creates can't exceed the Free dynamic limit (5)", ok === 1 && dyn === 5, { ok, dyn, statuses: race.map((r) => r.status) });
  check("over-limit request gets a clear 403", race.some((r) => r.status === 403 && /dynamic QR codes/.test(r.data.error)));
  check("custom alias blocked on Free (403)", (await call("POST", "/api/qrcodes", { name: "A", type: "url", content: { url: "https://e.x" }, design: {}, alias: `x${RUN}` }, E.jar)).status === 403);
  const freePlan = (await call("GET", "/api/admin/plans", undefined, S)).data.plans.find((p: any) => p.id === "free");
  const { users: _fu, liveSubscriptions: _fl, sync: _fs, status: _fst, updatedAt: _fup, ...freeInput } = freePlan;
  await call("PATCH", "/api/admin/plans/free", { plan: { ...freeInput, limits: { ...freeInput.limits, analyticsExport: false, analyticsDays: 0 } } }, S);
  check("analytics disabled by plan → 403", (await call("GET", "/api/analytics", undefined, E.jar)).status === 403);
  check("analytics export disabled by plan → 403", (await call("GET", "/api/analytics/export", undefined, E.jar)).status === 403);
  await call("PATCH", "/api/admin/plans/free", { plan: freeInput }, S);

  section("Branding");
  const png = (w: number, h: number, pad = 64) => { const b = Buffer.alloc(33 + pad); Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").copy(b); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  const upload = async (kind: string, name: string, data: Buffer, jar: Jar, type = "image/png") => {
    const fd = new FormData(); fd.set("kind", kind); fd.set("file", new Blob([new Uint8Array(data)], { type }), name);
    const r = await fetch(BASE + "/api/admin/branding/assets", { method: "POST", headers: { Origin: BASE, Cookie: cookieHeader(jar), "X-Forwarded-For": IP }, body: fd });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
  check("customers can't upload branding (401)", (await upload("logo", "l.png", png(300, 80), u0.jar)).status === 401);
  const logo = await upload("logo", "logo.png", png(300, 80), A);
  check("valid PNG logo uploaded", logo.status === 201 && /^[a-f0-9]{32}\.png$/.test(logo.data.asset?.storedName), logo.data);
  const fav = await upload("favicon", "fav.png", png(512, 512), A);
  check("valid favicon uploaded", fav.status === 201, fav.data);
  check("non-square favicon rejected", (await upload("favicon", "f.png", png(300, 80), A)).status === 400);
  check("oversized logo rejected (413)", (await upload("logo", "big.png", png(300, 80, 1_200_000), A)).status === 413);
  check("mismatched content rejected (415)", (await upload("logo", "fake.png", Buffer.from("<html><script>alert(1)</script></html>"), A)).status === 415);
  check("GIF rejected (415)", (await upload("logo", "x.gif", Buffer.from("GIF89a....."), A, "image/gif")).status === 415);
  check("SVG with script rejected (415)", (await upload("logo", "x.svg", Buffer.from(`<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`), A, "image/svg+xml")).status === 415);
  const cleanSvg = await upload("logoDark", "dark.svg", Buffer.from(`<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="60" fill="#fff"/></svg>`), A, "image/svg+xml");
  check("plain SVG accepted for the dark logo", cleanSvg.status === 201, cleanSvg.data);
  const br = await call("GET", "/api/admin/branding", undefined, A);
  const draft = { ...br.data.published, siteTitle: `Brand ${RUN} — test`, brandName: `Brand${RUN}`, primaryColor: "#0e7490", logo: logo.data.asset.storedName, logoDark: cleanSvg.data.asset.storedName, favicon: fav.data.asset.storedName };
  check("XSS in site title rejected", (await call("PUT", "/api/admin/branding", { ...draft, siteTitle: "<script>alert(1)</script>" }, A)).status === 400);
  check("CSS injection via colour rejected", (await call("PUT", "/api/admin/branding", { ...draft, primaryColor: "red}body{display:none" }, A)).status === 400);
  check("foreign asset name rejected", (await call("PUT", "/api/admin/branding", { ...draft, logo: "0123456789abcdef0123456789abcdef.png" }, A)).status === 400);
  check("customers can't change branding (401)", (await call("PUT", "/api/admin/branding", draft, u0.jar)).status === 401);
  check("draft saved", (await call("PUT", "/api/admin/branding", draft, A)).status === 200);
  let home = await (await fetch(BASE + "/")).text();
  check("draft doesn't change the live site", !home.includes(`Brand${RUN}`));
  check("publish", (await call("POST", "/api/admin/branding", { action: "publish" }, A)).status === 200);
  home = await (await fetch(BASE + "/")).text();
  check("published title in <title> via metadata", home.includes(`<title>Brand ${RUN} — test</title>`), home.match(/<title>[^<]*<\/title>/)?.[0]);
  check("favicon and logos reference the uploads", home.includes(`/brand/${fav.data.asset.storedName}`) && home.includes(`/brand/${logo.data.asset.storedName}`));
  check("brand colour applied as a CSS variable", home.includes(`--brand:${hexToHslTriplet("#0e7490")}`), home.match(/--brand:[^;]+/)?.[0]);
  const asset = await fetch(BASE + `/brand/${cleanSvg.data.asset.storedName}`);
  check("SVG asset served sandboxed with nosniff", asset.headers.get("content-type") === "image/svg+xml" && /sandbox/.test(asset.headers.get("content-security-policy") || "") && asset.headers.get("x-content-type-options") === "nosniff");
  check("user uploads (/f) are also served with a sandboxing CSP", /sandbox/.test((await fetch(BASE + "/f/0123456789abcdef0123456789abcdef.pdf")).headers.get("content-security-policy") || ""));
  check("unknown asset → 404", (await fetch(BASE + "/brand/0123456789abcdef0123456789abcdef.png")).status === 404);
  check("reset loads defaults into the draft only", (await call("POST", "/api/admin/branding", { action: "reset" }, A)).status === 200 && (await (await fetch(BASE + "/")).text()).includes(`Brand${RUN}`));
  check("discard draft", (await call("POST", "/api/admin/branding", { action: "discard" }, A)).status === 200 && (await call("GET", "/api/admin/branding", undefined, A)).data.draft === null);
  check("branding changes audited", (await db.auditLog.count({ where: { action: { in: ["admin.branding.published", "admin.branding.logo_replaced", "admin.branding.asset_uploaded"] } } })) >= 3);

  section("No secret leaks");
  const pages = ["/", "/pricing", "/admin/settings/payments", "/api/admin/payments/config", "/api/admin/system", "/api/admin/plans", "/api/admin/subscriptions", "/api/admin/payments", "/api/admin/security?pageSize=100"];
  let leak = "";
  for (const p of pages) { const r = await fetch(BASE + p, { headers: { Cookie: cookieHeader(S) } }); if (secretsLeaked(await r.text())) leak += p + " "; }
  check("no secret in pages or admin APIs", !leak, leak);
  const logs = JSON.stringify(await db.log.findMany({ take: 1000, orderBy: { createdAt: "desc" } })) + JSON.stringify(await db.auditLog.findMany({ take: 2000, orderBy: { createdAt: "desc" } })) + JSON.stringify(await db.webhookEvent.findMany({ take: 500 }));
  check("no secret in logs, audit log or webhook ledger", !SECRET_STRINGS().some((x) => logs.includes(x)));
  check("credential changes audited by field name", (await db.auditLog.findMany({ where: { action: "admin.payments.credentials_updated" } })).some((a) => /keySecret/.test(a.details) && !secretsLeaked(a.details)));
} finally {
  // Restore configuration and remove test data.
  const users = await db.user.findMany({ where: { email: { in: created } }, select: { id: true } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.setting.deleteMany({ where: { key: { in: settingKeys } } });
  for (const s of savedSettings) await db.setting.create({ data: s });
  const keep = new Set(savedPlans.map((p) => p.id));
  await db.providerPlan.deleteMany({ where: { id: { notIn: [...savedProviderPlans] } } });
  await db.pricingPlan.deleteMany({ where: { id: { notIn: [...keep] } } });
  for (const p of savedPlans) await db.pricingPlan.update({ where: { id: p.id }, data: { ...p, createdAt: undefined, updatedAt: undefined } });
  await db.$disconnect();
  server.close();
  console.log(`\n(${users.length} test accounts deleted; plans and settings restored)`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
