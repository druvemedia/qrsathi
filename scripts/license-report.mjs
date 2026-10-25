/**
 * Lists the licences of every installed production dependency (direct and
 * transitive). Fails on licences that would restrict commercial or
 * proprietary use of the app (strong copyleft) unless allow-listed.
 *
 *   node scripts/license-report.mjs            summary
 *   node scripts/license-report.mjs --all      every package
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const out = execSync("npm ls --omit=dev --all --parseable", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim().split(/\r?\n/).slice(1);
const seen = new Map();
for (const dir of out) {
  try {
    const p = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
    const lic = typeof p.license === "string" ? p.license : p.license?.type || (Array.isArray(p.licenses) ? p.licenses.map((l) => l.type).join(" OR ") : "UNKNOWN");
    seen.set(`${p.name}@${p.version}`, lic);
  } catch {}
}
const byLicense = {};
for (const [pkg, lic] of seen) (byLicense[lic] ||= []).push(pkg);
const COPYLEFT = /\b(A?GPL|LGPL|SSPL|EUPL|OSL|CC-BY-SA|CC-BY-NC)/i;
// Reviewed exceptions. @img/sharp-*: prebuilt libvips (LGPL-3.0-or-later), loaded
// dynamically by Next.js image optimisation (optional dependency of next). LGPL
// permits this in proprietary/commercial apps; keep the libvips licence notice.
const ALLOW = [/^@img\/sharp-/];
console.log(`${seen.size} production packages\n`);
for (const [lic, pkgs] of Object.entries(byLicense).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(pkgs.length).padStart(4)}  ${lic}${process.argv.includes("--all") || COPYLEFT.test(lic) || lic === "UNKNOWN" ? `\n        ${pkgs.join(", ")}` : ""}`);
}
const flagged = [...seen].filter(([pkg, lic]) => (COPYLEFT.test(lic) && !/\bOR\b/.test(lic)) && !ALLOW.some((re) => re.test(pkg)));
if (flagged.length) {
  console.log(`\nNeeds review (copyleft without a permissive alternative):\n${flagged.map(([p, l]) => `  ${p}: ${l}`).join("\n")}`);
  process.exit(1);
}
