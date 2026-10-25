/**
 * Generates prisma/mysql/schema.prisma from the canonical prisma/schema.prisma
 * (SQLite). The models stay identical; only the datasource and MySQL column
 * types/index prefix lengths are added. Run after every schema change:
 *
 *   npm run db:mysql:schema           (writes the file)
 *   npm run db:mysql:schema -- --check (CI: fails if the file is stale)
 *
 * Then create a MySQL migration with `npm run db:mysql:migration -- <name>`.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(root, "prisma/schema.prisma");
const OUT = path.join(root, "prisma/mysql/schema.prisma");

/**
 * Column types. Prisma's MySQL default for String is VARCHAR(191) — enough for
 * every field not listed here. Long fields are sized from the API validation
 * limits (see the zod schemas in src/lib). Fields with @default("") must stay
 * VARCHAR: MySQL rejects literal defaults on TEXT columns.
 */
export const TYPES = {
  "QrCode.content": "@db.MediumText", // hosted pages / menus
  "QrCode.design": "@db.MediumText", // may embed a logo data URL
  "QrCode.payload": "@db.Text",
  "QrCode.destination": "@db.Text",
  "QrCode.utm": "@db.Text",
  "Upload.filename": "@db.VarChar(255)",
  "AbuseReport.url": "@db.VarChar(2000)",
  "AbuseReport.details": "@db.VarChar(2000)",
  "Log.message": "@db.VarChar(2000)",
  "Setting.value": "@db.Text",
  "Product.description": "@db.VarChar(2000)",
  "Product.imageUrl": "@db.VarChar(1000)",
  "Barcode.format": "@db.VarChar(32)",
  "Barcode.value": "@db.VarChar(1500)", // validation max 1500 (2-D symbologies)
  "Barcode.lookupKey": "@db.VarChar(1500)",
  "InventoryTransaction.note": "@db.VarChar(500)",
  "Session.userAgent": "@db.VarChar(255)",
  "AuditLog.details": "@db.VarChar(4000)",
  "User.mfaSecret": "@db.Text",
  "Payment.failureReason": "@db.VarChar(500)",
  "PricingPlan.description": "@db.VarChar(500)",
  "PricingPlan.features": "@db.VarChar(4000)", // JSON, validated max 20 × 120 chars
  "PricingPlan.limits": "@db.VarChar(4000)", // JSON entitlements
  "WebhookEvent.summary": "@db.VarChar(500)",
};

/** Index rewrites: InnoDB keys are limited to 3072 bytes (768 utf8mb4 chars). */
const INDEX_REWRITES = [
  ["@@unique([userId, format, value])", "@@unique([userId, format, value(length: 512)])"],
  ["@@index([userId, lookupKey])", "@@index([userId, lookupKey(length: 512)])"],
];

export function toMysql(src) {
  let out = src;
  out = out.replace(/datasource db \{[\s\S]*?\}/, `datasource db {\n  provider     = "mysql"\n  url          = env("DATABASE_URL")\n  relationMode = "foreignKeys"\n}`);
  out = out.replace(
    /generator client \{[\s\S]*?\}/,
    `generator client {\n  provider = "prisma-client-js"\n}\n\n// Separate client used only by scripts/db/sqlite-to-mysql.mts, so generating it\n// never replaces the app's development (SQLite) client.\ngenerator mysqlMigrate {\n  provider = "prisma-client-js"\n  output   = "../../node_modules/.qrsathi/mysql-client"\n}`,
  );
  // Leading comment block → generated-file banner.
  out = out.replace(/^(\/\/.*\r?\n)+/, "// GENERATED from prisma/schema.prisma by scripts/db/mysql-schema.mjs — do not edit.\n// MySQL 8.0+ (utf8mb4). Run `npm run db:mysql:schema` after changing the main schema.\n");

  let model = "";
  const seen = new Set();
  out = out.split(/\r?\n/).map((line) => {
    const m = /^model (\w+) \{/.exec(line);
    if (m) model = m[1];
    if (line.startsWith("}")) model = "";
    const f = /^(\s+)(\w+)(\s+)(String\??)(.*)$/.exec(line);
    if (model && f) {
      const key = `${model}.${f[2]}`;
      if (TYPES[key]) {
        seen.add(key);
        // Insert the native type before any trailing // comment.
        const [attrs, ...comment] = f[5].split(" //");
        return `${f[1]}${f[2]}${f[3]}${f[4]}${attrs.replace(/\s+$/, "")} ${TYPES[key]}${comment.length ? " //" + comment.join(" //") : ""}`;
      }
    }
    return line;
  }).join("\n");
  const missing = Object.keys(TYPES).filter((k) => !seen.has(k));
  if (missing.length) throw new Error(`mysql-schema: fields not found in schema.prisma: ${missing.join(", ")}`);
  for (const [a, b] of INDEX_REWRITES) {
    if (!out.includes(a)) throw new Error(`mysql-schema: index not found: ${a}`);
    out = out.replace(a, b);
  }
  return out.endsWith("\n") ? out : out + "\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const next = toMysql(readFileSync(SRC, "utf8"));
  if (process.argv.includes("--check")) {
    let cur = "";
    try { cur = readFileSync(OUT, "utf8"); } catch {}
    if (cur.replace(/\r\n/g, "\n") !== next) {
      console.error("prisma/mysql/schema.prisma is out of date. Run: npm run db:mysql:schema");
      process.exit(1);
    }
    console.log("prisma/mysql/schema.prisma is up to date.");
  } else {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, next);
    console.log("Wrote prisma/mysql/schema.prisma");
  }
}
