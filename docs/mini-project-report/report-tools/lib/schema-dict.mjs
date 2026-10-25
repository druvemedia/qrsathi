// Parses prisma/schema.prisma (and the MySQL variant for column types) into a data dictionary.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const ROOT = path.resolve(import.meta.dirname, "../../../..");

function parse(file) {
  const src = readFileSync(file, "utf8");
  const models = [];
  const re = /((?:^\/\/\/.*\n)*)model (\w+) \{([\s\S]*?)\n\}/gm;
  let m;
  while ((m = re.exec(src))) {
    const doc = m[1].split("\n").map((l) => l.replace(/^\/\/\/\s?/, "")).filter(Boolean).join(" ");
    const fields = [], blockAttrs = [];
    for (const raw of m[3].split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//")) continue;
      if (line.startsWith("@@")) { blockAttrs.push(line); continue; }
      const fm = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line);
      if (!fm) continue;
      const [, name, type, list, opt, rest] = fm;
      const comment = (rest.match(/\/\/\s*(.*)$/) || [])[1] || "";
      const attrs = rest.replace(/\/\/.*$/, "").trim();
      fields.push({ name, type, list: !!list, optional: !!opt, attrs, comment });
    }
    models.push({ name: m[2], doc, fields, blockAttrs });
  }
  return models;
}

export const models = parse(path.join(ROOT, "prisma/schema.prisma"));
const mysql = Object.fromEntries(parse(path.join(ROOT, "prisma/mysql/schema.prisma")).map((x) => [x.name, x]));
const scalar = new Set(["String", "Int", "Boolean", "DateTime", "Float", "Json"]);

export function mysqlType(model, f) {
  const mf = mysql[model]?.fields.find((x) => x.name === f.name);
  const db = mf && /@db\.(\w+(?:\(\d+\))?)/.exec(mf.attrs);
  if (db) return db[1].toUpperCase();
  return { String: "VARCHAR(191)", Int: "INT", Boolean: "TINYINT(1)", DateTime: "DATETIME(3)" }[f.type] || f.type;
}

export function dictionaryMarkdown() {
  const out = [];
  for (const mo of models) {
    out.push(`#### ${mo.name}`);
    if (mo.doc) out.push(`*${mo.doc}*`);
    out.push("");
    out.push("| Field | Prisma type | MySQL column | Null | Key / constraint | Default | Notes |");
    out.push("|---|---|---|---|---|---|---|");
    for (const f of mo.fields) {
      if (!scalar.has(f.type)) continue; // relation fields listed below
      const keys = [];
      if (/@id/.test(f.attrs)) keys.push("PK");
      if (/@unique/.test(f.attrs)) keys.push("UNIQUE");
      const rel = mo.fields.find((r) => !scalar.has(r.type) && new RegExp(`fields: \\[${f.name}\\]`).test(r.attrs));
      if (rel) keys.push(`FK → ${rel.type}.id`);
      const def = (/@default\(((?:[^()]|\([^()]*\))*)\)/.exec(f.attrs) || [])[1] || (/@updatedAt/.test(f.attrs) ? "auto (updatedAt)" : "");
      out.push(`| ${f.name} | ${f.type} | ${mysqlType(mo.name, f)} | ${f.optional ? "Yes" : "No"} | ${keys.join(", ")} | ${def.replace(/\|/g, "\\|")} | ${f.comment.replace(/\|/g, "/")} |`);
    }
    const rels = mo.fields.filter((f) => !scalar.has(f.type));
    if (rels.length) {
      out.push("");
      out.push(`Relations: ${rels.map((r) => {
        const od = (/onDelete: (\w+)/.exec(r.attrs) || [])[1];
        return `\`${r.name}\` → ${r.type}${r.list ? " (one-to-many)" : r.optional ? " (optional many-to-one)" : " (many-to-one)"}${od ? `, on delete ${od}` : ""}`;
      }).join("; ")}.`);
    }
    if (mo.blockAttrs.length) {
      out.push("");
      out.push(`Composite constraints / indexes: ${mo.blockAttrs.map((a) => `\`${a}\``).join(", ")}.`);
    }
    out.push("");
  }
  return out.join("\n");
}

export function summaryRows() {
  return models.map((mo) => {
    const scal = mo.fields.filter((f) => scalar.has(f.type));
    const idx = mo.blockAttrs.filter((a) => a.startsWith("@@index")).length;
    const uq = mo.blockAttrs.filter((a) => a.startsWith("@@unique")).length + scal.filter((f) => /@unique/.test(f.attrs)).length;
    const fks = mo.fields.filter((f) => !scalar.has(f.type) && /fields:/.test(f.attrs)).map((f) => f.type);
    return { name: mo.name, columns: scal.length, uniques: uq, indexes: idx, fks };
  });
}

