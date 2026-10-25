// Writes diagram sources to ../diagrams and renders SVG + PNG with the local Mermaid build
// inside headless Chrome/Edge (no external rendering service is used).
//   npm run diagrams     (set BROWSER=path\to\chrome.exe if auto-detection fails)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";
import { DIAGRAMS as BASE, PUML } from "./data/diagrams.mjs";
import { REPLACED, SPLIT } from "./data/diagrams-split.mjs";

const require = createRequire(import.meta.url);
const OUT = path.resolve(import.meta.dirname, "../diagrams");
export const DIAGRAMS = [...BASE.filter((d) => !REPLACED.includes(d.file)), ...SPLIT];
export const BROWSER = [
  process.env.BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => existsSync(p));

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("render-diagrams.mjs")) {
  mkdirSync(path.join(OUT, "rendered"), { recursive: true });
  for (const d of DIAGRAMS) writeFileSync(path.join(OUT, d.file), `%% Figure ${d.fig}: ${d.title}\n${d.src}\n`);
  for (const [f, s] of Object.entries(PUML)) writeFileSync(path.join(OUT, f), s);

  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true });
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff"><div id="c"></div></body></html>`);
  await page.addScriptTag({ path: require.resolve("mermaid/dist/mermaid.min.js") });
  await page.evaluate(() => {
    window.mermaid.initialize({
      startOnLoad: false, theme: "neutral", securityLevel: "strict",
      themeVariables: { fontFamily: "Arial, Helvetica, sans-serif", fontSize: "15px" },
      flowchart: { htmlLabels: true, curve: "basis", nodeSpacing: 26, rankSpacing: 24, padding: 8, diagramPadding: 8, useMaxWidth: false },
      sequence: { useMaxWidth: false, mirrorActors: false, wrap: true, width: 140, actorMargin: 30, messageMargin: 30 },
      er: { useMaxWidth: false }, class: { useMaxWidth: false },
    });
  });
  const results = [];
  for (const d of DIAGRAMS) {
    const base = d.file.replace(/\.mmd$/, "");
    try {
      let svg = await page.evaluate(async (id, src) => (await window.mermaid.render(id, src)).svg, "d_" + base.replace(/\W/g, "_"), d.src);
      // Give the SVG its natural size (Mermaid otherwise sets width:100%).
      const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
      if (vb) svg = svg.replace(/<svg([^>]*?) width="[^"]*"/, "<svg$1").replace(/<svg([^>]*?) style="[^"]*"/, "<svg$1").replace("<svg", `<svg width="${Math.ceil(vb[3])}" height="${Math.ceil(vb[4])}"`);
      writeFileSync(path.join(OUT, "rendered", `${base}.svg`), svg);
      await page.setViewport({ width: 5000, height: 1200, deviceScaleFactor: 1 });
      await page.evaluate((s) => { const c = document.getElementById("c"); c.innerHTML = s; const el = c.querySelector("svg"); el.style.maxWidth = "none"; el.style.background = "#fff"; }, svg);
      const box = await (await page.$("#c svg")).boundingBox();
      await page.setViewport({ width: Math.ceil(box.width) + 20, height: Math.ceil(box.height) + 20, deviceScaleFactor: 2 });
      await (await page.$("#c svg")).screenshot({ path: path.join(OUT, "rendered", `${base}.png`) });
      results.push({ file: d.file, figure: d.fig, title: d.title, ok: true, width: Math.round(box.width), height: Math.round(box.height) });
    } catch (e) {
      results.push({ file: d.file, figure: d.fig, ok: false, error: String(e.message || e).slice(0, 300) });
    }
  }
  await browser.close();
  writeFileSync(path.join(OUT, "rendered", "render-report.json"), JSON.stringify(results, null, 2));
  for (const r of results) console.log(r.ok ? `OK   ${r.file} ${r.width}x${r.height}` : `FAIL ${r.file}: ${r.error}`);
  if (results.some((r) => !r.ok)) process.exit(1);
}
