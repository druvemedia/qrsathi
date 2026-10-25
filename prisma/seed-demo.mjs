/**
 * Creates a demo account with sample QR codes and clearly-flagged sample scans.
 * Refuses to run unless DEMO_MODE=true. Every record it creates has isDemo=true
 * and is labelled "Demo" in the UI and in CSV exports.
 *
 *   npm run seed:demo
 * Login: demo@demo.local / demo12345   (admin: admin@demo.local / admin12345 if listed in ADMIN_EMAILS)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";

// Minimal .env loader so the script works without extra dependencies.
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {}

if (process.env.DEMO_MODE !== "true") {
  console.error("Refusing to seed: set DEMO_MODE=\"true\" in .env (never in production).");
  process.exit(1);
}

const db = new PrismaClient();
const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const admins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase());

async function upsertUser(email, name, password, role = "user", plan = "free") {
  const passwordHash = await bcrypt.hash(password, 12);
  return db.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash, role, plan } });
}

const demo = await upsertUser("demo@demo.local", "Demo Shopkeeper", "demo12345", "user", "pro");
if (admins.includes("admin@demo.local")) await upsertUser("admin@demo.local", "Demo Admin", "admin12345", "admin", "business");

await db.qrCode.deleteMany({ where: { userId: demo.id, isDemo: true } });

const design = (o = {}) => JSON.stringify({ moduleStyle: "rounded", eyeOuter: "rounded", eyeInner: "rounded", frame: "banner", frameColor: "#4f46e5", frameText: "SCAN ME", ...o });
const samples = [
  { name: "Diwali offer page", type: "dynamic", content: { url: "https://example.com/diwali" }, dyn: true, code: "demo-diwali", campaign: "Diwali 2026" },
  { name: "Shop counter UPI", type: "upi", content: { vpa: "yourshop@upi", name: "Demo General Store", amount: "", note: "", mc: "", tr: "" }, dyn: false, frame: "PAY HERE" },
  { name: "Café menu", type: "menu", content: { delivery: "page", link: "", restaurant: "Demo Café", tagline: "Chai · Snacks · Meals", color: "#ea580c", items: [
    { category: "Hot drinks", name: "Masala chai", price: "30", description: "Ginger & cardamom" },
    { category: "Hot drinks", name: "Filter coffee", price: "40", description: "" },
    { category: "Snacks", name: "Samosa (2 pcs)", price: "40", description: "With mint chutney" },
    { category: "Snacks", name: "Vada pav", price: "35", description: "" },
  ] }, hosted: true, code: "demo-menu", campaign: "Table tents" },
  { name: "Instagram follow", type: "instagram", content: { username: "@example" }, dyn: true, code: "demo-insta", campaign: "Social" },
  { name: "Guest Wi-Fi", type: "wifi", content: { ssid: "Demo-Guest", password: "welcome123", security: "WPA", hidden: false }, dyn: false, frame: "FREE WI-FI" },
];

const devices = ["mobile", "mobile", "mobile", "mobile", "tablet", "desktop"];
const browsers = { Android: ["Chrome", "Samsung Internet", "Chrome", "Instagram app"], iOS: ["Safari", "Safari", "Chrome"], Windows: ["Chrome", "Edge"] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

for (const s of samples) {
  const hosted = !!s.hosted;
  const dynamic = hosted || s.dyn;
  const payload = hosted ? `${base}/p/${s.code}` : dynamic ? `${base}/r/${s.code}` :
    s.type === "upi" ? `upi://pay?pa=yourshop@upi&pn=Demo%20General%20Store&cu=INR` : `WIFI:T:WPA;S:Demo-Guest;P:welcome123;;`;
  const destination = !dynamic || hosted ? null : s.type === "instagram" ? "https://instagram.com/example" : s.content.url;
  await db.qrCode.deleteMany({ where: { shortCode: s.code ?? "__none__" } });
  const qr = await db.qrCode.create({
    data: {
      userId: demo.id, name: s.name, type: s.type, content: JSON.stringify(s.content),
      design: design(s.frame ? { frameText: s.frame, frameColor: "#ea580c" } : {}), payload,
      isDynamic: dynamic, isHosted: hosted, shortCode: dynamic ? s.code : null, destination,
      campaign: s.campaign || "", isDemo: true,
    },
  });
  if (!dynamic) continue;
  const scans = [];
  const n = 120 + Math.floor(Math.random() * 380);
  for (let i = 0; i < n; i++) {
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.6) * 60);
    const d = new Date(Date.now() - daysAgo * 86400000);
    d.setUTCHours(3 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 60));
    const device = pick(devices);
    const os = device === "desktop" ? "Windows" : Math.random() < 0.8 ? "Android" : "iOS";
    scans.push({
      qrId: qr.id, createdAt: d, device, os, browser: pick(browsers[os]),
      country: Math.random() < 0.92 ? "IN" : pick(["AE", "US", "GB", "SG"]),
      visitorHash: Math.random() < 0.08 ? "" : `demo${Math.floor(Math.random() * n * 0.7)}-${d.toISOString().slice(0, 10)}`,
      isDemo: true,
    });
  }
  await db.scan.createMany({ data: scans });
  console.log(`  ${s.name}: ${n} demo scans`);
}

await db.log.create({ data: { level: "info", event: "demo.seeded", message: "Demo data created by seed-demo.mjs" } });
console.log("\nDemo ready. Log in with demo@demo.local / demo12345");
await db.$disconnect();
