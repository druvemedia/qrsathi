/**
 * MySQL integration test (real server required):
 *   MYSQL_TEST_URL="mysql://root:pw@127.0.0.1:3307/" npm run test:mysql
 *
 * Creates throw-away databases named qrsathi_test_<random> (and drops only
 * those), builds an edge-case SQLite source in the OS temp folder, applies the
 * MySQL migrations, runs the real SQLite → MySQL migration script and checks:
 *  - exact round-trip of IDs, FKs, ms timestamps, NULLs, booleans, unicode,
 *    1,500-character barcodes, ints and money in paise
 *  - case-sensitive identifiers (short codes "AbC" vs "abc") stay distinct
 *  - case-insensitive search still works on free-text columns
 *  - refusal to write into a non-empty target, and pre-flight failures
 *    (orphaned FK, case-only duplicate e-mails) write nothing
 * Refuses non-local servers unless MYSQL_TEST_ALLOW_REMOTE=true.
 */
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.MYSQL_TEST_URL;
if (!base) { console.log("SKIPPED: set MYSQL_TEST_URL (e.g. mysql://root:pw@127.0.0.1:3307/) to run the MySQL integration test."); process.exit(0); }
const host = new URL(base).hostname;
if (!["127.0.0.1", "localhost", "::1", "mysql"].includes(host) && process.env.MYSQL_TEST_ALLOW_REMOTE !== "true")
  throw new Error(`Refusing to run against non-local MySQL host ${host}.`);

let pass = 0, fail = 0;
const ok = (cond: unknown, name: string, extra = "") => {
  if (cond) { pass++; console.log(`  ✔ ${name}`); } else { fail++; console.log(`  ✖ ${name} ${extra}`); }
};
const sh = (cmd: string, args: string[], env: Record<string, string> = {}) =>
  spawnSync(cmd, args, { cwd: root, env: { ...process.env, ...env }, encoding: "utf8", shell: process.platform === "win32" });

const tmp = mkdtempSync(path.join(os.tmpdir(), "qrsathi-mysql-test-"));
const dbUrl = (name: string) => { const u = new URL(base); u.pathname = `/${name}`; return u.toString(); };
const created: string[] = [];

function sqliteSource(file: string) {
  const r = sh("npx", ["prisma", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], { DATABASE_URL: `file:${file}` });
  if (r.status !== 0) throw new Error(`db push failed: ${r.stderr || r.stdout}`);
  const db = new DatabaseSync(file);
  const ins = (table: string, row: Record<string, unknown>) => {
    const keys = Object.keys(row);
    const vals = keys.map((k) => { const v = row[k]; return v instanceof Date ? v.getTime() : typeof v === "boolean" ? (v ? 1 : 0) : v; });
    db.prepare(`INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...(vals as any[]));
  };
  return { db, ins };
}

const NOW = new Date(Date.UTC(2026, 9, 25, 10, 11, 12, 345));
const LONG = "X".repeat(1400) + "é".repeat(100); // 1,500 chars, multi-byte tail

function seedFull(file: string) {
  const { db, ins } = sqliteSource(file);
  ins("User", { id: "u1", email: "asha@example.in", name: "आशा 😀 O'Brien", passwordHash: "$2a$12$abcdefghijklmnopqrstuuJ1kZ0hY8Q6Q2l1b0aJmQb9XyVq0wFvW", role: "super_admin", plan: "pro", planExpiresAt: NOW, status: "active", sessionVersion: 3, createdAt: NOW, updatedAt: NOW, lastLoginAt: null, mfaSecret: "v1:aa:bb:cc", mfaEnabledAt: NOW, mfaLastStep: 59000000 });
  ins("User", { id: "u2", email: "ravi@example.in", name: "Ravi", passwordHash: null, googleId: "1234567890", role: "user", plan: "free", status: "suspended", sessionVersion: 0, createdAt: NOW, updatedAt: NOW });
  ins("QrCode", { id: "q1", userId: "u1", name: "Upper", type: "url", content: JSON.stringify({ url: "https://e.x/" + "a".repeat(3000) }), design: JSON.stringify({ logo: "data:image/png;base64," + "A".repeat(200_000) }), payload: "https://app/r/AbC12", isDynamic: true, isHosted: false, shortCode: "AbC12", destination: "https://example.com/ünï", status: "active", expiresAt: null, utm: null, campaign: "", trackScans: true, favorite: false, isDemo: false, createdAt: NOW, updatedAt: NOW });
  ins("QrCode", { id: "q2", userId: "u1", name: "Lower", type: "url", content: "{}", design: "{}", payload: "https://app/r/abc12", isDynamic: true, isHosted: true, shortCode: "abc12", destination: null, status: "paused", createdAt: NOW, updatedAt: NOW });
  ins("QrCode", { id: "q3", userId: "u2", name: "Static", type: "text", content: "{}", design: "{}", payload: "hello", isDynamic: false, shortCode: null, createdAt: NOW, updatedAt: NOW });
  for (let i = 0; i < 1200; i++) ins("Scan", { id: `s${i}`, qrId: i % 2 ? "q1" : "q2", createdAt: new Date(NOW.getTime() - i * 61_000), device: "mobile", browser: "Chrome", os: "Android", country: "IN", visitorHash: createHash("sha256").update(String(i)).digest("hex").slice(0, 32), isDemo: false });
  ins("Download", { id: "d1", userId: "u1", qrId: null, name: "x.png", format: "png", createdAt: NOW });
  ins("Upload", { id: "up1", userId: "u1", filename: "Menü (final).pdf", storedName: "AbCdEf123.pdf", mime: "application/pdf", size: 12345, createdAt: NOW });
  ins("Upload", { id: "up2", userId: "u1", filename: "menu.pdf", storedName: "abcdef123.pdf", mime: "application/pdf", size: 1, createdAt: NOW });
  ins("AbuseReport", { id: "r1", shortCode: "AbC12", url: "https://x/" + "u".repeat(1900), reason: "phishing", details: "d".repeat(2000), reporterEmail: "", status: "open", createdAt: NOW });
  ins("Payment", { id: "p1", userId: "u1", provider: "razorpay", providerRef: "plink_ABC", plan: "pro", amount: 29900, status: "paid", createdAt: NOW, updatedAt: NOW });
  ins("Payment", { id: "p2", userId: "u1", provider: "razorpay", providerRef: "plink_abc", plan: "pro", amount: 2147483647, status: "created", createdAt: NOW, updatedAt: NOW });
  ins("Log", { id: "l1", level: "error", event: "x", message: "m".repeat(2000), userId: null, createdAt: NOW });
  ins("Setting", { key: "siteName", value: JSON.stringify("QRSathi ✓") });
  ins("Product", { id: "pr1", userId: "u1", name: "Chai 250 g", sku: "SKU-a", productCode: "", brand: "", category: "Tea", variant: "", description: "x".repeat(2000), manufacturer: "", imageUrl: "https://i/" + "p".repeat(980), priceMinor: 12550, currency: "INR", stock: -5, lowStockAt: 5, batch: "", expiryDate: null, status: "active", createdAt: NOW, updatedAt: NOW });
  ins("Product", { id: "pr2", userId: "u1", name: "chai 250 G", sku: "SKU-A", priceMinor: 0, stock: 1_000_000_000, createdAt: NOW, updatedAt: NOW });
  ins("Barcode", { id: "b1", userId: "u1", productId: "pr1", format: "datamatrix", value: LONG, lookupKey: LONG, source: "internal", isPrimary: true, createdAt: NOW });
  ins("Barcode", { id: "b2", userId: "u1", productId: "pr2", format: "code128", value: "abc", lookupKey: "abc", source: "existing", isPrimary: false, createdAt: NOW });
  ins("Barcode", { id: "b3", userId: "u1", productId: "pr2", format: "code128", value: "ABC", lookupKey: "ABC", source: "existing", isPrimary: false, createdAt: NOW });
  ins("InventoryTransaction", { id: "t1", userId: "u1", productId: "pr1", type: "out", quantity: -5, balance: -5, note: "n".repeat(300), reference: "INV/1", createdAt: NOW });
  ins("Session", { id: "se1", userId: "u1", kind: "admin", mfa: true, createdAt: NOW, expiresAt: new Date(NOW.getTime() + 3600_000), lastSeenAt: NOW, userAgent: "Mozilla/5.0 " + "z".repeat(200) });
  ins("MfaRecoveryCode", { id: "m1", userId: "u1", codeHash: "ab".repeat(32), usedAt: null, createdAt: NOW });
  ins("MfaRecoveryCode", { id: "m2", userId: "u1", codeHash: "AB".repeat(32), usedAt: NOW, createdAt: NOW });
  ins("PasswordReset", { id: "pw1", userId: "u2", tokenHash: "cd".repeat(32), expiresAt: NOW, usedAt: null, createdAt: NOW });
  ins("AuditLog", { id: "a1", actorId: "u1", actorEmail: "asha@example.in", action: "admin.user.suspended", targetType: "user", targetId: "u2", details: JSON.stringify({ k: "v".repeat(3900) }), ip: "0123456789abcdef", createdAt: NOW });
  ins("RateLimit", { key: "login:Asha", count: 3, resetAt: NOW });
  ins("RateLimit", { key: "login:asha", count: 1, resetAt: NOW });
  db.close();
}

const mysqlClient = () => {
  const r = sh("npx", ["prisma", "generate", "--schema", "prisma/mysql/schema.prisma", "--generator", "mysqlMigrate"]);
  if (r.status !== 0) throw new Error(r.stderr);
  return createRequire(import.meta.url)(path.join(root, "node_modules/.qrsathi/mysql-client")) as typeof import("@prisma/client");
};

async function main() {
  const { PrismaClient } = mysqlClient();
  const admin = new PrismaClient({ datasourceUrl: dbUrl("mysql") });
  const newDb = async () => {
    const name = `qrsathi_test_${randomBytes(4).toString("hex")}`;
    await admin.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created.push(name);
    const r = sh("npx", ["prisma", "migrate", "deploy", "--schema", "prisma/mysql/schema.prisma"], { DATABASE_URL: dbUrl(name) });
    if (r.status !== 0) throw new Error(`migrate deploy failed: ${r.stdout}\n${r.stderr}`);
    return name;
  };
  const migrate = (sqlite: string, target: string) =>
    sh("npx", ["tsx", "scripts/db/sqlite-to-mysql.mts", "--sqlite", sqlite, "--backup-dir", path.join(tmp, "backups")], { MYSQL_URL: dbUrl(target) });

  try {
    console.log("\n1. Schema");
    const t1 = await newDb();
    ok(true, `migrate deploy applied to fresh MySQL database ${t1}`);
    const status = sh("npx", ["prisma", "migrate", "status", "--schema", "prisma/mysql/schema.prisma"], { DATABASE_URL: dbUrl(t1) });
    ok(/up to date/i.test(status.stdout), "migrate status reports the schema up to date (no drift)");
    const again = sh("npx", ["prisma", "migrate", "deploy", "--schema", "prisma/mysql/schema.prisma"], { DATABASE_URL: dbUrl(t1) });
    ok(again.status === 0 && /No pending migrations/i.test(again.stdout), "re-running deploy is a no-op");

    console.log("\n2. Full edge-case migration");
    const src = path.join(tmp, "full.db");
    seedFull(src);
    const before = createHash("sha256").update(readFileSync(src)).digest("hex");
    const r = migrate(src, t1);
    ok(r.status === 0, "migration script succeeded", r.stdout + r.stderr);
    ok(/✔ Migration verified/.test(r.stdout), "row-hash verification passed for every table");
    ok(createHash("sha256").update(readFileSync(src)).digest("hex") === before, "source SQLite file unchanged");

    const db = new PrismaClient({ datasourceUrl: dbUrl(t1) });
    try {
      const u1 = await db.user.findUnique({ where: { id: "u1" } });
      ok(u1?.name === "आशा 😀 O'Brien", "unicode + emoji preserved");
      ok(u1?.planExpiresAt?.getTime() === NOW.getTime() && u1?.createdAt.getTime() === NOW.getTime(), "timestamps preserved to the millisecond");
      ok(u1?.lastLoginAt === null && u1?.mfaLastStep === 59000000 && u1?.sessionVersion === 3, "NULLs and integers preserved");
      ok((await db.user.findUnique({ where: { id: "u2" } }))?.passwordHash === null, "nullable password hash preserved");
      ok((await db.qrCode.findUnique({ where: { shortCode: "abc12" } }))?.id === "q2", "short code lookup is case-sensitive (abc12 → q2)");
      ok((await db.qrCode.findUnique({ where: { shortCode: "AbC12" } }))?.id === "q1", "short code lookup is case-sensitive (AbC12 → q1)");
      const q1 = await db.qrCode.findUnique({ where: { id: "q1" } });
      ok(q1?.design.length === JSON.stringify({ logo: "data:image/png;base64," + "A".repeat(200_000) }).length, "200 KB design JSON (MEDIUMTEXT) preserved");
      ok(q1?.isDynamic === true && q1.trackScans === true && q1.favorite === false, "booleans preserved");
      const b1 = await db.barcode.findUnique({ where: { id: "b1" } });
      ok(b1?.value === LONG && b1.value.length === 1500, "1,500-character barcode value preserved");
      ok((await db.barcode.findMany({ where: { userId: "u1", lookupKey: "abc" } })).map((b) => b.id).join() === "b2", "barcode lookup is case-sensitive");
      ok((await db.product.findMany({ where: { userId: "u1", sku: "SKU-A" } })).map((p) => p.id).join() === "pr2", "SKU lookup is case-sensitive");
      ok((await db.product.findMany({ where: { userId: "u1", name: { contains: "CHAI" } } })).length === 2, "free-text search stays case-insensitive");
      ok((await db.payment.findUnique({ where: { id: "p2" } }))?.amount === 2147483647, "INT max preserved (money in paise)");
      ok((await db.product.findUnique({ where: { id: "pr1" } }))?.priceMinor === 12550, "price in paise preserved");
      ok((await db.scan.count()) === 1200, "1,200 scans copied");
      ok((await db.scan.count({ where: { qrId: "q1" } })) === 600, "scan foreign keys preserved");
      ok((await db.rateLimit.count()) === 2, "binary-collated keys that differ only by case both migrated");

      // Constraints are live in MySQL
      const dupSku = await db.product.create({ data: { userId: "u1", name: "x", sku: "SKU-a" } }).then(() => false, () => true);
      ok(dupSku, "unique (userId, sku) enforced");
      const dupCode = await db.barcode.create({ data: { userId: "u1", productId: "pr1", format: "datamatrix", value: LONG, lookupKey: "k" } }).then(() => false, () => true);
      ok(dupCode, "unique (userId, format, value) enforced for long values");
      const orphan = await db.scan.create({ data: { qrId: "nope" } }).then(() => false, () => true);
      ok(orphan, "foreign keys enforced");
      await db.user.delete({ where: { id: "u2" } });
      ok((await db.qrCode.count({ where: { userId: "u2" } })) === 0 && (await db.passwordReset.count()) === 0, "ON DELETE CASCADE works");
      const tx = await db.product.updateMany({ where: { id: "pr2", stock: { gte: 10 } }, data: { stock: { decrement: 10 } } });
      ok(tx.count === 1, "conditional atomic stock update works");
    } finally {
      await db.$disconnect();
    }

    console.log("\n3. Safety checks");
    const r2 = migrate(src, t1);
    ok(r2.status !== 0 && /already has/.test(r2.stdout + r2.stderr), "refuses to write into a non-empty database");

    const t2 = await newDb();
    const bad = path.join(tmp, "orphan.db");
    {
      const { db, ins } = sqliteSource(bad);
      db.exec("PRAGMA foreign_keys = OFF");
      ins("User", { id: "u1", email: "a@x.in", createdAt: NOW, updatedAt: NOW });
      ins("QrCode", { id: "q1", userId: "ghost", name: "o", type: "url", content: "{}", design: "{}", payload: "x", createdAt: NOW, updatedAt: NOW });
      db.close();
    }
    const r3 = migrate(bad, t2);
    ok(r3.status !== 0 && /reference a missing User/.test(r3.stdout), "pre-flight catches orphaned foreign keys");

    const dup = path.join(tmp, "dup.db");
    {
      const { db, ins } = sqliteSource(dup);
      ins("User", { id: "u1", email: "Same@x.in", createdAt: NOW, updatedAt: NOW });
      ins("User", { id: "u2", email: "same@x.in", createdAt: NOW, updatedAt: NOW });
      db.close();
    }
    const r4 = migrate(dup, t2);
    ok(r4.status !== 0 && /would collide/.test(r4.stdout), "pre-flight catches case-only duplicate e-mails");
    const check = new PrismaClient({ datasourceUrl: dbUrl(t2) });
    ok((await check.user.count()) === 0, "failed pre-flight wrote nothing");
    await check.$disconnect();
  } finally {
    for (const name of created) await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${name}\``).catch(() => {});
    await admin.$disconnect();
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
