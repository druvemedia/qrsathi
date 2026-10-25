/**
 * Administrator bootstrap and recovery CLI. Runs on the server with direct
 * database access — the only way (besides a super administrator in the
 * console) to grant administrator roles. Nothing here is reachable over HTTP.
 *
 *   npm run admin -- create  --email you@company.com [--name "Your Name"] [--super]
 *   npm run admin -- promote --email user@company.com [--super]
 *   npm run admin -- demote  --email user@company.com
 *   npm run admin -- reset-mfa --email admin@company.com
 *   npm run admin -- list
 *
 * Passwords are read from a hidden prompt, or from stdin when piped
 * (e.g. in CI: `printf '%s\n' "$PW" | npm run admin -- create --email ... --password-stdin`).
 * They are never accepted as command-line arguments (shell history, process lists).
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth-helpers";

try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {}

const USAGE = `Usage:
  npm run admin -- create    --email <email> [--name <name>] [--super] [--password-stdin]
  npm run admin -- promote   --email <email> [--super]
  npm run admin -- demote    --email <email>
  npm run admin -- reset-mfa --email <email>
  npm run admin -- list`;

const [cmd, ...rest] = process.argv.slice(2);
const flags: Record<string, string | true> = {};
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith("--")) continue;
  const next = rest[i + 1];
  if (next && !next.startsWith("--")) { flags[a.slice(2)] = next; i++; } else flags[a.slice(2)] = true;
}
if (typeof flags.password === "string") {
  console.error("Refusing --password on the command line. Use the prompt or --password-stdin.");
  process.exit(2);
}

const fail = (msg: string): never => { console.error(`✖ ${msg}`); process.exit(1); };
const email = typeof flags.email === "string" ? flags.email.trim().toLowerCase() : "";
const needEmail = () => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Provide a valid --email.");
  return email;
};

const COMMON = ["password", "12345678", "qwerty", "letmein", "welcome", "admin", "qrsathi", "changeme", "iloveyou"];
export function checkAdminPassword(pw: string, mail: string) {
  if (pw.length < 12) return "Administrator passwords must be at least 12 characters.";
  if (pw.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Use at least one letter and one number.";
  const lower = pw.toLowerCase();
  const local = mail.split("@")[0];
  if (local.length >= 4 && lower.includes(local)) return "The password must not contain your e-mail name.";
  if (COMMON.some((c) => lower.includes(c))) return "That password is too easy to guess.";
  if (new Set(pw).size < 6) return "Use more varied characters.";
  return null;
}

async function readHidden(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) fail("No terminal for a hidden prompt. Pipe the password and pass --password-stdin.");
  process.stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let buf = "";
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(buf);
        }
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(130); }
        if (c === "\u007f" || c === "\b") buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function readStdinLine(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0];
}

async function getPassword(mail: string) {
  if (flags["password-stdin"]) {
    const pw = await readStdinLine();
    const err = checkAdminPassword(pw, mail);
    if (err) fail(err);
    return pw;
  }
  for (;;) {
    const pw = await readHidden("New administrator password: ");
    const err = checkAdminPassword(pw, mail);
    if (err) { console.error(`  ${err}`); continue; }
    if ((await readHidden("Repeat password: ")) !== pw) { console.error("  Passwords don't match."); continue; }
    return pw;
  }
}

const db = new PrismaClient();
const auditCli = (action: string, targetId: string, details: Record<string, unknown> = {}) =>
  db.auditLog.create({ data: { actorEmail: "cli", action, targetType: "user", targetId, details: JSON.stringify(details), ip: "" } });

async function main() {
  switch (cmd) {
    case "create": {
      const mail = needEmail();
      if (await db.user.findUnique({ where: { email: mail } })) fail(`An account for ${mail} already exists. Use "promote" instead.`);
      const role = flags.super ? "super_admin" : "admin";
      const pw = await getPassword(mail);
      const u = await db.user.create({
        data: { email: mail, name: typeof flags.name === "string" ? flags.name.slice(0, 80) : "", passwordHash: await hashPassword(pw), role, plan: "business" },
      });
      await auditCli("admin.cli.created", u.id, { role });
      console.log(`✔ Created ${role === "super_admin" ? "super administrator" : "administrator"} ${mail}.`);
      console.log(`  Sign in at /admin/login${role === "super_admin" ? " — you'll be asked to set up two-factor authentication first." : "."}`);
      break;
    }
    case "promote": {
      const mail = needEmail();
      const u = await db.user.findUnique({ where: { email: mail } });
      if (!u) fail(`No account for ${mail}. Use "create", or have them sign up first.`);
      const role = flags.super ? "super_admin" : "admin";
      if (u!.role === role) { console.log(`${mail} is already ${role}.`); break; }
      // New role → existing sessions end (sign in again at /admin/login).
      await db.user.update({ where: { id: u!.id }, data: { role, sessionVersion: { increment: 1 } } });
      await db.session.deleteMany({ where: { userId: u!.id } });
      await auditCli("admin.cli.role_changed", u!.id, { from: u!.role, to: role });
      console.log(`✔ ${mail}: ${u!.role} → ${role}. Existing sessions were signed out.`);
      if (!u!.passwordHash) console.log("  Note: this account has no password (Google-only). Use \"Forgot password\" to set one before signing in to the admin console.");
      break;
    }
    case "demote": {
      const mail = needEmail();
      const u = await db.user.findUnique({ where: { email: mail } });
      if (!u) fail(`No account for ${mail}.`);
      if (u!.role === "user") { console.log(`${mail} is already an ordinary user.`); break; }
      if (u!.role === "super_admin" && u!.status === "active") {
        const others = await db.user.count({ where: { role: "super_admin", status: "active", id: { not: u!.id } } });
        if (!others) fail("This is the last active super administrator. Promote another one first.");
      }
      await db.user.update({ where: { id: u!.id }, data: { role: "user", sessionVersion: { increment: 1 }, mfaEnabledAt: null, mfaSecret: null, mfaLastStep: 0 } });
      await db.session.deleteMany({ where: { userId: u!.id } });
      await db.mfaRecoveryCode.deleteMany({ where: { userId: u!.id } });
      await auditCli("admin.cli.role_changed", u!.id, { from: u!.role, to: "user" });
      console.log(`✔ ${mail} is now an ordinary user. Sessions signed out; two-factor setup cleared.`);
      break;
    }
    case "reset-mfa": {
      const mail = needEmail();
      const u = await db.user.findUnique({ where: { email: mail } });
      if (!u) fail(`No account for ${mail}.`);
      await db.user.update({ where: { id: u!.id }, data: { mfaEnabledAt: null, mfaSecret: null, mfaLastStep: 0, sessionVersion: { increment: 1 } } });
      await db.session.deleteMany({ where: { userId: u!.id } });
      await db.mfaRecoveryCode.deleteMany({ where: { userId: u!.id } });
      await auditCli("admin.cli.mfa_reset", u!.id);
      console.log(`✔ Two-factor authentication reset for ${mail}; all sessions signed out.`);
      console.log("  Verify the person's identity out of band before doing this. They must enrol again at next sign-in.");
      break;
    }
    case "list": {
      const admins = await db.user.findMany({ where: { role: { in: ["admin", "super_admin"] } }, orderBy: { createdAt: "asc" } });
      if (!admins.length) console.log('No administrators yet. Create one with: npm run admin -- create --email you@company.com --super');
      for (const a of admins) console.log(`${a.role.padEnd(12)} ${a.status.padEnd(10)} 2FA:${a.mfaEnabledAt ? "on " : "off"}  ${a.email}`);
      break;
    }
    default:
      console.log(USAGE);
      process.exit(cmd ? 2 : 0);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e))).finally(() => db.$disconnect());
