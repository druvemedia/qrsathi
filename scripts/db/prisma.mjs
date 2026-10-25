/**
 * Runs Prisma against the schema that matches DATABASE_URL:
 *   file:…   → prisma/schema.prisma        (SQLite, development)
 *   mysql:// → prisma/mysql/schema.prisma  (MySQL, production)
 * The provider is fixed when the client is generated (build time); nothing
 * switches databases at runtime.
 *
 *   node scripts/db/prisma.mjs generate   generate the client for this provider
 *   node scripts/db/prisma.mjs deploy     apply schema changes safely:
 *                                          MySQL  → prisma migrate deploy (versioned, non-destructive)
 *                                          SQLite → prisma db push (refuses data-losing changes)
 *   node scripts/db/prisma.mjs schema     print the schema path
 */
import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
try {
  for (const line of readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {}

const url = process.env.DATABASE_URL || "file:./dev.db";
const provider = url.startsWith("mysql://") ? "mysql" : url.startsWith("file:") ? "sqlite" : null;
if (!provider) {
  console.error("DATABASE_URL must start with file: (SQLite) or mysql:// (MySQL).");
  process.exit(1);
}
const schema = provider === "mysql" ? "prisma/mysql/schema.prisma" : "prisma/schema.prisma";

const run = (...args) => {
  const r = spawnSync("npx", ["prisma", ...args, "--schema", schema], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  process.exit(r.status ?? 1);
};

const cmd = process.argv[2];
if (cmd === "schema") console.log(schema);
else if (cmd === "generate") {
  console.log(`[db] ${provider} → ${schema}`);
  // Only the default client; the MySQL migration client is generated on demand by the data-migration script.
  run("generate", ...(provider === "mysql" ? ["--generator", "client"] : []));
} else if (cmd === "deploy") {
  console.log(`[db] ${provider} → ${schema}`);
  if (provider === "mysql") run("migrate", "deploy");
  else run("db", "push", "--skip-generate");
} else {
  console.error("Usage: node scripts/db/prisma.mjs generate|deploy|schema");
  process.exit(2);
}
