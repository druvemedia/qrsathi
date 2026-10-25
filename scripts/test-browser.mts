/**
 * Browser automation tests for the Universal Scanner (headless Edge/Chrome via
 * the DevTools protocol — no extra dependencies):
 *  1. Camera: a barcode is fed as a fake webcam (Y4M video) to /scanner?camera=1
 *  2. Upload: an image with several codes is set on the file input
 *  3. Responsive: main pages at 375/768/1280 px never scroll horizontally, have
 *     no Content-Security-Policy violations or console errors, and pass basic
 *     accessibility checks (set SHOT_DIR=folder to save screenshots, DARK=1 for dark mode)
 *  4. Admin console (when DATABASE_URL points at the server's database): signs in
 *     through the real /admin/login form and checks every console page the same way
 * SKIP_SCANNER=1 skips sections 1–2; ADMIN_ONLY=1 also skips the workspace pages.
 * Each test waits until the decoded values appear in the page.
 *   BASE_URL=http://localhost:3100 npm run test:browser
 * Set BROWSER=path/to/chrome to use another Chromium browser.
 */
import { execSync, spawn } from "child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import sharp from "sharp";
import bwipjs from "bwip-js/node";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const browser = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => existsSync(p!));
if (!browser) {
  console.log("SKIP  no Chromium-based browser found (set BROWSER=...)");
  process.exit(0);
}

const dir = mkdtempSync(path.join(tmpdir(), "qrsathi-browser-"));
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, info = "") => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  → ${info.slice(0, 300).replace(/\s+/g, " ")}`}`);
};

async function codePng(bcid: string, text: string) {
  const opts: Record<string, unknown> = { bcid, text, scale: bcid === "qrcode" || bcid === "datamatrix" ? 6 : 4, paddingwidth: 20, paddingheight: 20, backgroundcolor: "FFFFFF" };
  if (!["qrcode", "datamatrix", "pdf417"].includes(bcid)) Object.assign(opts, { height: 18, includetext: true });
  return bwipjs.toBuffer(opts as any);
}

/** Greyscale I420 Y4M with the code centred on a 1280×720 frame. */
async function makeY4m(bcid: string, text: string, file: string) {
  const W = 1280, H = 720;
  const code = await codePng(bcid, text);
  const meta = await sharp(code).metadata();
  const y = await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
    .composite([{ input: code, left: Math.round((W - meta.width!) / 2), top: Math.round((H - meta.height!) / 2) }])
    .toColourspace("b-w").extractChannel(0).raw().toBuffer();
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  const parts: Buffer[] = [Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420jpeg\n`)];
  for (let i = 0; i < 30; i++) parts.push(Buffer.from("FRAME\n"), y, uv, uv);
  writeFileSync(file, Buffer.concat(parts));
}

interface Page { eval: (expr: string) => Promise<any>; send: (method: string, params?: object) => Promise<any>; close: () => void; logs: string[] }

async function openPage(url: string, extraArgs: string[], tag: string): Promise<Page> {
  const port = 9300 + Math.floor(Math.random() * 600);
  const proc = spawn(browser!, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${path.join(dir, `profile-${tag}`)}`, `--remote-debugging-port=${port}`, ...extraArgs, url,
  ], { stdio: "ignore" });
  const kill = () => {
    try {
      if (process.platform === "win32") execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore" });
      else proc.kill("SIGKILL");
    } catch {}
  };
  let wsUrl = "";
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; url: string; webSocketDebuggerUrl: string }[];
      wsUrl = list.find((t) => t.type === "page" && t.url.startsWith(BASE))?.webSocketDebuggerUrl || "";
    } catch {}
  }
  if (!wsUrl) { kill(); throw new Error("browser did not start"); }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const logs: string[] = [];
  ws.addEventListener("message", (ev: MessageEvent) => {
    const m = JSON.parse(String(ev.data));
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) logs.push(m.params.args.map((a: any) => a.value ?? a.description ?? "").join(" "));
    if (m.method === "Runtime.exceptionThrown") logs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params.entry.level)) logs.push(`[${m.params.entry.source}] ${m.params.entry.text}`);
  });
  let id = 0;
  const send = (method: string, params: object = {}) => new Promise<any>((resolve) => {
    const my = ++id;
    const onMsg = (ev: MessageEvent) => {
      const m = JSON.parse(String(ev.data));
      if (m.id === my) { ws.removeEventListener("message", onMsg); resolve(m.result); }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id: my, method, params }));
  });
  await send("Runtime.enable");
  await send("Log.enable");
  return {
    logs,
    send,
    eval: async (expression: string) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))?.result?.value,
    close: () => { ws.close(); kill(); },
  };
}

async function waitForText(page: Page, needles: string[], tries = 40) {
  let text = "";
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 750));
    text = (await page.eval("document.body ? document.body.innerText : ''")) || "";
    if (needles.every((n) => text.includes(n))) break;
  }
  return text;
}

/** Elements without an accessible name (inputs, buttons, links, images). */
const A11Y = `(() => {
  const bad = [];
  const name = (el) => (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || "").trim();
  for (const el of document.querySelectorAll("input:not([type=hidden]), select, textarea")) {
    if (el.closest("[aria-hidden=true]") || el.offsetParent === null) continue;
    const labelled = name(el) || (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) || el.closest("label");
    if (!labelled) bad.push(el.outerHTML.slice(0, 80));
  }
  for (const el of document.querySelectorAll("button, a[href]")) {
    if (el.offsetParent === null) continue;
    const forLabel = el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
    if (!(el.innerText || "").trim() && !name(el) && !forLabel && !el.querySelector("img[alt]:not([alt=''])")) bad.push(el.outerHTML.slice(0, 80));
  }
  for (const el of document.querySelectorAll("img")) if (!el.hasAttribute("alt")) bad.push(el.outerHTML.slice(0, 80));
  return JSON.stringify(bad);
})()`;
const NOISE = /favicon|Download the React DevTools|\[violation\]|ERR_ABORTED/i;

try {
  if (!process.env.SKIP_SCANNER) {
  // ---------- 1. camera ----------
  console.log("# Camera scanning (fake webcam)");
  for (const [bcid, text, kind] of [
    ["ean13", "8901234567890", "Product barcode"],
    ["code128", "CAM-TEST-42", "Code 128"],
    ["qrcode", "https://example.com/camera-test", "Website link"],
    ["datamatrix", "DM-CAMERA-7", "Data Matrix"],
  ] as const) {
    const video = path.join(dir, `${bcid}.y4m`);
    await makeY4m(bcid, text, video);
    const page = await openPage(`${BASE}/scanner?camera=1`, ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${video}`], `cam-${bcid}`);
    try {
      const t = await waitForText(page, [text, kind]);
      check(`camera → ${bcid} "${text}" shown as ${kind}`, t.includes(text) && t.includes(kind), t + (page.logs.length ? " | console: " + page.logs.join(" | ") : ""));
      if (bcid === "ean13") {
        const hist = await page.eval("localStorage.getItem('qrsathi:scans:v2') || ''");
        check("camera scan saved to on-device history", String(hist).includes(text), String(hist));
      }
    } finally {
      page.close();
    }
  }

  // ---------- 2. image upload with several codes ----------
  console.log("\n# Image upload (multiple codes)");
  const tiles = await Promise.all([codePng("ean13", "8901234567890"), codePng("code39", "UPLOAD-39"), codePng("qrcode", "upi://pay?pa=shop@okaxis&pn=Test&cu=INR"), codePng("pdf417", "PDF417-UPLOAD")]);
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const width = Math.max(...metas.map((m) => m.width!)) + 80;
  let top = 40;
  const comp = tiles.map((t, i) => { const o = { input: t, top, left: 40 }; top += metas[i].height! + 80; return o; });
  const sheet = path.join(dir, "multi.png");
  await sharp({ create: { width, height: top, channels: 3, background: "#ffffff" } }).composite(comp).png().toFile(sheet);

  const page = await openPage(`${BASE}/scanner`, [], "upload");
  try {
    await waitForText(page, ["Universal Scanner"], 20);
    // Server-rendered HTML appears before React hydrates: wait until React has attached its handlers to the file input.
    const fileSel = "input[type=file][accept='image/*']";
    for (let i = 0; i < 40; i++) {
      if (await page.eval(`(() => { const el = document.querySelector("${fileSel}"); return !!el && Object.keys(el).some(k => k.startsWith("__reactProps")); })()`)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    check("scanner offers Upload image without switching modes", String(await page.eval("document.body.innerText")).includes("Upload image"));
    const doc = await page.send("DOM.getDocument", { depth: -1, pierce: true });
    const q = await page.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: fileSel });
    await page.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [sheet] });
    const want = ["8901234567890", "UPLOAD-39", "shop@okaxis", "PDF417-UPLOAD", "4 codes detected"];
    const t0 = Date.now();
    const t = await waitForText(page, want, Number(process.env.UPLOAD_TRIES || 40));
    console.log(`   upload decode took ~${((Date.now() - t0) / 1000).toFixed(1)}s`);
    for (const w of want) check(`upload → "${w}"`, t.includes(w), t);
    if (page.logs.length) console.log("   browser console:", page.logs.join(" | ").slice(0, 600));
    check("UPI QR from upload shows payment warning, not a payment", t.includes("UPI payment request") && t.includes("Only scan a UPI QR to PAY"), t);
  } finally {
    page.close();
  }

  }

  // ---------- 3. responsive layout ----------
  console.log("\n# Responsive layout (no horizontal page overflow)");
  const shotDir = process.env.SHOT_DIR;
  const publicPages = ["/", "/generator", "/barcodes", "/scanner", "/scan-history", "/bulk", "/upi", "/pricing", "/help", "/login", "/signup", "/forgot-password", "/admin/login", "/admin/forgot-password"];
  const privatePages = ["/dashboard", "/codes", "/products", "/products/new", "/inventory", "/analytics", "/dynamic", "/dashboard/settings", "/studio"];
  const rpage = await openPage(`${BASE}/login`, [], "responsive");
  const email = `ui-${Date.now()}@example.com`;
  try {
    await waitForText(rpage, ["Welcome back"], 30);
    const visit = async (path: string, width: number, expect?: string) => {
      rpage.logs.length = 0;
      await rpage.send("Emulation.setDeviceMetricsOverride", { width, height: width < 600 ? 800 : 900, deviceScaleFactor: 1, mobile: width < 600 });
      if (process.env.DARK) await rpage.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
      await rpage.send("Page.navigate", { url: BASE + path });
      await new Promise((r) => setTimeout(r, 400));
      for (let i = 0; i < 30; i++) {
        if ((await rpage.eval("document.readyState")) === "complete") break;
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((r) => setTimeout(r, 900)); // let client data load
      const m = await rpage.eval("JSON.stringify({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, title: document.title })");
      const { sw, iw } = JSON.parse(m);
      const offenders = sw > iw + 1 ? await rpage.eval(`(() => { const out = []; for (const el of document.querySelectorAll("body *")) { const r = el.getBoundingClientRect(); if (r.right <= innerWidth + 1 || !r.width) continue; let p = el.parentElement, clipped = false; while (p) { if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) { clipped = true; break; } p = p.parentElement; } if (!clipped) out.push(el.tagName + "." + String(el.className).slice(0, 60) + "@" + Math.round(r.right)); } return out.slice(0, 5).join(" ; "); })()`) : "";
      check(`${String(width).padStart(4)}px ${path} fits the screen`, sw <= iw + 1, `scrollWidth ${sw} > ${iw}: ${offenders}`);
      if (expect) {
        const text = String(await rpage.eval("document.body.innerText"));
        check(`${String(width).padStart(4)}px ${path} renders "${expect}"`, text.includes(expect), text.slice(0, 200));
      }
      const problems = rpage.logs.filter((l) => !NOISE.test(l));
      const csp = problems.filter((l) => /Content Security Policy|Refused to/i.test(l));
      check(`${String(width).padStart(4)}px ${path} no CSP violations`, csp.length === 0, csp.join(" | "));
      if (width === 1280) {
        check(`        ${path} no console errors`, problems.length === 0, problems.join(" | "));
        const a11y = JSON.parse(await rpage.eval(A11Y));
        check(`        ${path} controls, links and images have accessible names`, a11y.length === 0, a11y.join(" , "));
      }
      if (shotDir) {
        const shot = await rpage.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        writeFileSync(path.length > 1 ? `${shotDir}/${width}${path.replace(/\//g, "_")}.png` : `${shotDir}/${width}_home.png`, Buffer.from(shot.data, "base64"));
      }
    };
    if (!process.env.ADMIN_ONLY) for (const w of [375, 768, 1280]) for (const p of publicPages) await visit(p, w);
    // Sign up a throwaway user inside the page so the session cookie is set for this browser.
    const signed = await rpage.eval(`fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "UI Test", email: "${email}", password: "testpass123", acceptTerms: true }) }).then(r => r.status)`);
    check("temporary user signed in for private pages", signed === 201, String(signed));
    if (!process.env.ADMIN_ONLY) for (const w of [375, 768, 1280]) for (const p of privatePages) await visit(p, w);

    // ---------- 4. admin console ----------
    if (process.env.DATABASE_URL) {
      console.log("\n# Admin console");
      const { spawnSync } = await import("child_process");
      const adminEmail = `ui-admin-${Date.now()}@example.com`;
      const pw = "Console-Ui-Pass-73q";
      const made = spawnSync("npx", ["tsx", "scripts/admin.mts", "create", "--email", adminEmail, "--password-stdin"], { input: pw + "\n", encoding: "utf8", env: process.env, shell: process.platform === "win32" });
      check("test administrator created with the CLI", made.status === 0, made.stderr + made.stdout);
      try {
        await rpage.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        await rpage.send("Page.navigate", { url: BASE + "/admin/login?next=%2Fadmin%2Fusers" });
        await waitForText(rpage, ["Administrator sign-in"], 30);
        for (let i = 0; i < 40; i++) {
          if (await rpage.eval(`(() => { const el = document.querySelector("#email"); return !!el && Object.keys(el).some(k => k.startsWith("__reactProps")); })()`)) break;
          await new Promise((r) => setTimeout(r, 250));
        }
        // Type into the real form (React-controlled inputs) and submit.
        await rpage.eval(`(() => {
          const set = (sel, v) => { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
          set("#email", ${JSON.stringify(adminEmail)}); set("#password", ${JSON.stringify(pw)});
        })()`);
        await new Promise((r) => setTimeout(r, 200));
        await rpage.eval(`document.querySelector("form button[type=submit]").click()`);
        let landed = "";
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 250));
          landed = String(await rpage.eval("location.pathname"));
          if (landed === "/admin/users") break;
        }
        check("admin signs in through the /admin/login form and returns to ?next", landed === "/admin/users", landed);
        const pages: [string, string][] = [
          ["/admin", "Platform overview"], ["/admin/users", "All accounts"], ["/admin/qr-codes", "Dynamic & hosted codes"], ["/admin/reports", "Reports"],
          ["/admin/products", "Barcodes by format"], ["/admin/analytics", "Platform analytics"], ["/admin/subscriptions", "Paid accounts"], ["/admin/payments", "Payment records"],
          ["/admin/security", "Audit log"], ["/admin/settings", "Branding"], ["/admin/system", "Configuration"], ["/admin/mfa", "Set up authenticator app"],
        ];
        for (const w of [375, 768, 1280]) for (const [p, t] of pages) await visit(p, w, t);
        const nav = String(await rpage.eval("document.body.innerText"));
        check("admin console shows no workspace navigation", !nav.includes("QR Generator") && !nav.includes("Universal Scanner"), "");
      } finally {
        await rpage.eval(`fetch("/api/admin/auth/logout", { method: "POST" }).then(r => r.status)`).catch(() => {});
        const { PrismaClient } = await import("@prisma/client");
        const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
        await db.user.deleteMany({ where: { email: adminEmail } });
        await db.$disconnect();
      }
    }
  } finally {
    await rpage.eval(`fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "${email}" }) }).then(r => r.status)`).catch(() => {});
    rpage.close();
  }
} finally {
  await new Promise((r) => setTimeout(r, 1500));
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch {}
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
