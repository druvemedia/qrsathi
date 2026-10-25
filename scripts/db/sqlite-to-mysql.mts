/**
 * One-time data migration: SQLite (development file) → MySQL (production).
 *
 *   MYSQL_URL="mysql://user:pass@host:3306/qrsathi" npm run db:migrate-data -- [--sqlite prisma/dev.db] [--backup-dir prisma/backups] [--dry-run]
 *
 * Safety properties:
 *  - The SQLite file is never modified. A consistent snapshot is taken first
 *    (VACUUM INTO prisma/backups/…) and all data is read from that snapshot.
 *  - The MySQL database must already have the schema applied
 *    (`npm run db:mysql:deploy`) and contain no rows; otherwise nothing is written.
 *  - Pre-flight checks (lengths, integer ranges, orphaned foreign keys, unique
 *    collisions under MySQL collation rules) run before any write.
 *  - All rows are written in ONE transaction: any error rolls everything back.
 *  - Afterwards every table is read back and compared row-by-row (SHA-256 of
 *    normalised rows) with the source. IDs, foreign keys, timestamps (ms) and
 *    NULLs are preserved exactly.
 *
 * Rollback: the app keeps working on SQLite until you change DATABASE_URL.
 * To abandon a migrated MySQL database, drop and recreate it (see docs/DATABASE.md).
 */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = flag("dry-run");

function loadEnv() {
  try {
    for (const line of readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const log = (s = "") => console.log(s);
const die = (s: string): never => { console.error(`\n✖ ${s}`); process.exit(1); };

// ---------- source ----------
function sqlitePath() {
  const explicit = opt("sqlite");
  if (explicit) return path.resolve(root, explicit);
  const url = process.env.SQLITE_URL || (process.env.DATABASE_URL?.startsWith("file:") ? process.env.DATABASE_URL : "file:./dev.db");
  // Prisma resolves relative SQLite paths against the schema directory.
  return path.resolve(root, "prisma", url.replace(/^file:/, ""));
}

// ---------- MySQL client (separate generated client; never touches the app's SQLite client) ----------
const CLIENT_DIR = path.join(root, "node_modules/.qrsathi/mysql-client");
function loadMysqlClient() {
  if (!existsSync(path.join(CLIENT_DIR, "index.js")) || flag("generate")) {
    log("Generating the MySQL Prisma client (node_modules/.qrsathi/mysql-client)…");
    const r = spawnSync("npx", ["prisma", "generate", "--schema", "prisma/mysql/schema.prisma", "--generator", "mysqlMigrate"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    if (r.status !== 0) die("prisma generate failed.");
  }
  return createRequire(import.meta.url)(CLIENT_DIR) as typeof import("@prisma/client");
}

// ---------- column limits parsed from the MySQL schema ----------
type Limit = { kind: "chars" | "bytes"; max: number };
function columnLimits() {
  const src = readFileSync(path.join(root, "prisma/mysql/schema.prisma"), "utf8");
  const limits: Record<string, Limit> = {};
  let model = "";
  for (const line of src.split(/\r?\n/)) {
    const m = /^model (\w+) \{/.exec(line);
    if (m) model = m[1];
    if (line.startsWith("}")) model = "";
    const f = /^\s+(\w+)\s+String\??(.*)$/.exec(line);
    if (!model || !f) continue;
    const v = /@db\.VarChar\((\d+)\)/.exec(f[2]);
    limits[`${model}.${f[1]}`] = v ? { kind: "chars", max: +v[1] }
      : /@db\.MediumText/.test(f[2]) ? { kind: "bytes", max: 16_777_215 }
      : /@db\.Text/.test(f[2]) ? { kind: "bytes", max: 65_535 }
      : { kind: "chars", max: 191 };
  }
  return limits;
}

/** Columns given binary collation in the init migration (exact comparison). */
const BINARY = new Set(["QrCode.shortCode", "Subscription.providerSubscriptionId", "ProviderPlan.providerPlanId", "WebhookEvent.eventId", "BrandAsset.storedName", "Product.sku", "Barcode.value", "Barcode.lookupKey", "Upload.storedName", "Payment.providerRef", "PasswordReset.tokenHash", "MfaRecoveryCode.codeHash", "RateLimit.key"]);
const PREFIX: Record<string, number> = { "Barcode.value": 512 };

/** Approximate MySQL key equality: PAD SPACE always; case/accent-folding for *_ci columns. */
function uniqueKey(model: string, field: string, v: unknown) {
  if (typeof v !== "string") return String(v);
  let s = v.replace(/ +$/, "");
  if (PREFIX[`${model}.${field}`]) s = s.slice(0, PREFIX[`${model}.${field}`]);
  if (!BINARY.has(`${model}.${field}`)) s = s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return s;
}

const INT_MIN = -2147483648, INT_MAX = 2147483647;

async function main() {
  const src = sqlitePath();
  if (!existsSync(src)) die(`SQLite database not found: ${src}`);
  const mysqlUrl = process.env.MYSQL_URL;
  if (!dryRun && !mysqlUrl?.startsWith("mysql://")) die("Set MYSQL_URL to the target MySQL database (mysql://user:pass@host:3306/db).");

  log(`Source: ${path.relative(root, src)} (${(statSync(src).size / 1024).toFixed(0)} KB)`);

  // 1. Consistent snapshot (source untouched).
  const backupDir = path.resolve(root, opt("backup-dir") || "prisma/backups");
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
  const snapshot = path.join(backupDir, `${path.basename(src, ".db")}-pre-mysql-${stamp}.db`);
  {
    const s = new DatabaseSync(src, { readOnly: true });
    s.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
    s.close();
  }
  log(`Backup snapshot: ${path.relative(root, snapshot)}`);
  const sqlite = new DatabaseSync(snapshot, { readOnly: true });
  const integrity = (sqlite.prepare("PRAGMA integrity_check").get() as any).integrity_check;
  if (integrity !== "ok") die(`SQLite integrity_check failed: ${integrity}`);

  const { Prisma, PrismaClient } = loadMysqlClient();
  const models = Prisma.dmmf.datamodel.models;
  const limits = columnLimits();

  // Parents before children (foreign-key order).
  const order: string[] = [];
  const pending = new Set(models.map((m) => m.name));
  while (pending.size) {
    const before = pending.size;
    for (const name of [...pending]) {
      const m = models.find((x) => x.name === name)!;
      const deps = m.fields.filter((f) => f.relationFromFields?.length).map((f) => f.type).filter((t) => t !== name);
      if (deps.every((d) => !pending.has(d))) { order.push(name); pending.delete(name); }
    }
    if (pending.size === before) die(`Circular relations: ${[...pending].join(", ")}`);
  }

  // 2. Read + normalise every table.
  const tables = new Set((sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map((r) => r.name));
  const data: Record<string, Record<string, unknown>[]> = {};
  const problems: string[] = [];
  for (const name of order) {
    const m = models.find((x) => x.name === name)!;
    const scalars = m.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
    if (!tables.has(name)) { problems.push(`Table ${name} is missing in SQLite (run \`npx prisma db push\` on the source first).`); continue; }
    const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
    data[name] = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const f of scalars) {
        let v = r[f.name];
        if (v === undefined) v = null;
        if (v !== null) {
          if (f.type === "DateTime") {
            const ms = typeof v === "number" ? v : typeof v === "bigint" ? Number(v) : /^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v));
            if (!Number.isFinite(ms)) problems.push(`${name}.${f.name}: unreadable date ${JSON.stringify(v)}`);
            v = new Date(ms);
          } else if (f.type === "Boolean") v = v === 1 || v === 1n || v === true || v === "true";
          else if (f.type === "Int") {
            v = Number(v);
            if (!Number.isInteger(v) || (v as number) < INT_MIN || (v as number) > INT_MAX) problems.push(`${name}.${f.name}: integer out of MySQL INT range (${v})`);
          } else if (f.type === "String") {
            v = String(v);
            const lim = limits[`${name}.${f.name}`];
            const len = lim?.kind === "bytes" ? Buffer.byteLength(v as string, "utf8") : [...(v as string)].length;
            if (lim && len > lim.max) problems.push(`${name}.${f.name} (id ${r.id ?? r.key}): ${len} ${lim.kind} > MySQL limit ${lim.max}`);
          }
        } else if (f.isRequired) problems.push(`${name}.${f.name} (id ${r.id ?? r.key}): NULL in a required column`);
        o[f.name] = v;
      }
      return o;
    });
  }

  // 3. Orphaned foreign keys (MySQL enforces these).
  for (const name of order) {
    const m = models.find((x) => x.name === name)!;
    for (const rel of m.fields.filter((f) => f.relationFromFields?.length)) {
      const [fk] = rel.relationFromFields!;
      const [pk] = rel.relationToFields!;
      const parents = new Set((data[rel.type] || []).map((p) => p[pk]));
      const orphans = (data[name] || []).filter((r) => r[fk] !== null && !parents.has(r[fk]));
      if (orphans.length) problems.push(`${name}.${fk}: ${orphans.length} row(s) reference a missing ${rel.type}`);
    }
  }

  // 4. Unique collisions under MySQL comparison rules.
  for (const name of order) {
    const m = models.find((x) => x.name === name)!;
    const idField = m.fields.find((f) => f.isId)?.name;
    const groups: string[][] = [
      ...(idField ? [[idField]] : []),
      ...(m.primaryKey ? [m.primaryKey.fields as string[]] : []),
      ...m.fields.filter((f) => f.isUnique).map((f) => [f.name]),
      ...(m.uniqueFields as string[][]),
    ];
    for (const g of groups) {
      const seen = new Map<string, number>();
      for (const r of data[name] || []) {
        if (g.some((f) => r[f] === null)) continue;
        const k = g.map((f) => uniqueKey(name, f, r[f])).join("\u0000");
        seen.set(k, (seen.get(k) || 0) + 1);
      }
      const dups = [...seen.values()].filter((n) => n > 1).length;
      if (dups) problems.push(`${name} unique(${g.join(", ")}): ${dups} value(s) would collide in MySQL (case/accent/trailing-space differences)`);
    }
  }

  log("\nRows to migrate:");
  for (const name of order) log(`  ${name.padEnd(22)} ${String(data[name]?.length ?? 0).padStart(8)}`);
  if (problems.length) {
    log("\nPre-flight problems (nothing was written):");
    for (const p of problems) log(`  - ${p}`);
    die("Fix the problems above in the source data, then run again.");
  }
  log("\n✔ Pre-flight checks passed (lengths, integer ranges, NULLs, foreign keys, unique keys).");
  if (dryRun) { log("Dry run: no MySQL connection made, nothing written."); return; }

  // 5. Target must be migrated and empty.
  const db = new PrismaClient({ datasourceUrl: mysqlUrl });
  try {
    const applied = await db.$queryRawUnsafe<{ n: bigint }[]>("SELECT COUNT(*) AS n FROM `_prisma_migrations` WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL").catch(() => null);
    const expected = readdirSync(path.join(root, "prisma/mysql/migrations"), { withFileTypes: true }).filter((d) => d.isDirectory()).length;
    if (!applied || Number(applied[0].n) < expected) die("The MySQL schema isn't fully applied. Run `npm run db:mysql:deploy` against the target first.");
    for (const name of order) {
      const n = await (db as any)[name[0].toLowerCase() + name.slice(1)].count();
      if (n > 0) die(`Target table ${name} already has ${n} row(s). Migrate only into an empty database; nothing was written.`);
    }

    // 6. Copy in one transaction.
    log("\nCopying (single transaction)…");
    const t0 = Date.now();
    await db.$transaction(async (tx) => {
      for (const name of order) {
        const rows = data[name] || [];
        const delegate = (tx as any)[name[0].toLowerCase() + name.slice(1)];
        for (let i = 0; i < rows.length; i += 500) await delegate.createMany({ data: rows.slice(i, i + 500) });
        if (rows.length) log(`  ${name.padEnd(22)} ${rows.length}`);
      }
    }, { timeout: 60 * 60_000, maxWait: 60_000 });
    log(`Committed in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);

    // 7. Verify: counts + row hashes.
    const norm = (model: string, r: Record<string, unknown>) => {
      const m = models.find((x) => x.name === model)!;
      return JSON.stringify(m.fields.filter((f) => f.kind === "scalar").map((f) => {
        const v = r[f.name];
        return v instanceof Date ? v.getTime() : v ?? null;
      }));
    };
    const digest = (model: string, rows: Record<string, unknown>[]) => {
      const lines = rows.map((r) => norm(model, r)).sort();
      return createHash("sha256").update(lines.join("\n")).digest("hex");
    };
    const report: Record<string, { source: number; target: number; hashMatch: boolean }> = {};
    let ok = true;
    log("\nVerifying…");
    for (const name of order) {
      const target = await (db as any)[name[0].toLowerCase() + name.slice(1)].findMany();
      const r = { source: data[name].length, target: target.length, hashMatch: digest(name, data[name]) === digest(name, target) };
      report[name] = r;
      if (r.source !== r.target || !r.hashMatch) ok = false;
      log(`  ${name.padEnd(22)} ${String(r.source).padStart(8)} → ${String(r.target).padStart(8)}  ${r.hashMatch ? "✔ identical" : "✖ MISMATCH"}`);
    }
    const reportFile = path.join(backupDir, `mysql-migration-report-${stamp}.json`);
    writeFileSync(reportFile, JSON.stringify({ source: path.relative(root, src), snapshot: path.relative(root, snapshot), finishedAt: new Date().toISOString(), ok, tables: report }, null, 2));
    log(`\nReport: ${path.relative(root, reportFile)}`);
    if (!ok) die("Verification failed. Do not switch DATABASE_URL. Drop and recreate the MySQL database, then investigate.");
    log("\n✔ Migration verified. Next: set DATABASE_URL to the MySQL URL, run `npm run build`, start the app and smoke-test.");
    log("  The SQLite file was not changed; switching DATABASE_URL back restores the previous state.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
