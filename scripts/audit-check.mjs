/**
 * npm audit gate for CI. Fails on any high/critical advisory in production
 * dependencies unless it is listed in security/audit-allowlist.json with a
 * reason and an unexpired date. Moderate/low advisories are reported only.
 *
 *   node scripts/audit-check.mjs
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";

let raw;
try {
  raw = execSync("npm audit --omit=dev --json", { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
} catch (e) {
  raw = e.stdout; // npm audit exits non-zero when it finds anything
}
const report = JSON.parse(raw);
const allow = JSON.parse(readFileSync(new URL("../security/audit-allowlist.json", import.meta.url), "utf8")).advisories;
const today = new Date().toISOString().slice(0, 10);

const found = new Map();
for (const [name, v] of Object.entries(report.vulnerabilities || {}))
  for (const via of v.via) if (typeof via === "object") found.set(via.url.split("/").pop(), { pkg: via.dependency || name, severity: via.severity, title: via.title });

let failed = false;
for (const [id, a] of found) {
  const entry = allow.find((x) => x.id === id);
  const serious = a.severity === "high" || a.severity === "critical";
  if (entry && entry.expires >= today) console.log(`accepted  ${a.severity.padEnd(8)} ${id} ${a.pkg} (until ${entry.expires})`);
  else if (entry) { console.log(`EXPIRED   ${a.severity.padEnd(8)} ${id} ${a.pkg}: re-review the allow-list entry`); failed = true; }
  else if (serious) { console.log(`FAIL      ${a.severity.padEnd(8)} ${id} ${a.pkg}: ${a.title}`); failed = true; }
  else console.log(`notice    ${a.severity.padEnd(8)} ${id} ${a.pkg}: ${a.title}`);
}
for (const e of allow) if (!found.has(e.id)) console.log(`stale     ${e.id} no longer reported: remove it from the allow-list`);
console.log(found.size ? "" : "No advisories in production dependencies.");
process.exit(failed ? 1 : 0);
