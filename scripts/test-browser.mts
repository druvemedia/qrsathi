/**
 * Browser automation tests for the Universal Scanner (headless Edge/Chrome via
 * the DevTools protocol — no extra dependencies):
 *  1. Camera: a barcode is fed as a fake webcam (Y4M video) to /scanner?camera=1
 *  2. Upload: an image with several codes is set on the file input
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

try {
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
    // Server-rendered HTML appears before React hydrates; retry the click until Image mode is really shown.
    for (let i = 0; i < 30; i++) {
      await page.eval(`[...document.querySelectorAll('button[role=radio]')].find(b => b.textContent.trim() === 'Image')?.click()`);
      await new Promise((r) => setTimeout(r, 500));
      if (String(await page.eval("document.body.innerText")).includes("Drop an image")) break;
    }
    const doc = await page.send("DOM.getDocument", { depth: -1, pierce: true });
    const q = await page.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][accept='image/*']" });
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
} finally {
  await new Promise((r) => setTimeout(r, 1500));
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch {}
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
