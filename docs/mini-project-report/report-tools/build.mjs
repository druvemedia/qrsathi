// Builds the QRSathi mini project report from ../source/*.md:
//   QRSathi_Mini_Project_Report.pdf  (headless Chrome + pdf-lib page numbering)
//   QRSathi_Mini_Project_Report.docx (docx-js; TOC/LOF/LOT are Word fields — update on open)
//   QRSathi_Requirement_Traceability_Matrix.xlsx (ExcelJS)
//   standalone Markdown documents from ../source/standalone/*.md
// Usage: npm install && npm run diagrams && npm run build
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { marked } from "marked";
import puppeteer from "puppeteer-core";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as D from "docx";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { BROWSER } from "./render-diagrams.mjs";
import { summaryRows, dictionaryMarkdown, models } from "./lib/schema-dict.mjs";
import { TESTCASES, COLUMNS as TC_COLUMNS } from "./data/testcases.mjs";
import { FEATURES, FEATURE_COLUMNS } from "./data/features.mjs";
import { RTM, RTM_COLUMNS } from "./data/rtm.mjs";
import { API_PURPOSE } from "./data/api.mjs";
import { DEFECTS, DEFECT_COLUMNS } from "./data/defects.mjs";

const R = path.resolve(import.meta.dirname, "..");          // docs/mini-project-report
const ROOT = path.resolve(R, "../..");                        // repository root
const SRC = path.join(R, "source");
const TMP = path.join(R, "build", ".tmp");
fs.mkdirSync(TMP, { recursive: true });

export const META = {
  title: "QRSathi",
  subtitle: "QR Code, Barcode and Inventory Management System",
  kind: "A Mini Project Report",
  degree: "[Degree, e.g. Bachelor of Technology] in [Branch, e.g. Computer Science and Engineering]",
  student: "[Student Name]", roll: "[Roll Number]",
  guide: "[Guide Name]", guideDesignation: "[Designation]",
  department: "[Department Name]", institution: "[Institution Name]", university: "[University Name]",
  place: "[City, State]", monthYear: "[Month Year]", academicYear: "[Academic Year]",
  header: "QRSathi — Mini Project Report",
};

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const mdTable = (cols, rows) => [`| ${cols.join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");
const read = (f) => fs.readFileSync(f, "utf8");

// ---------------------------------------------------------------- generated content
function apiRoutes() {
  const out = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f === "route.ts") out.push(p); } };
  walk(path.join(ROOT, "src/app"));
  return out.map((file) => {
    const src = read(file);
    const rel = path.relative(path.join(ROOT, "src/app"), path.dirname(file)).replace(/\\/g, "/");
    const route = "/" + rel;
    const methods = [...src.matchAll(/export (?:const|async function) (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    const g = [];
    for (const m of src.matchAll(/requireAdmin\(([^)]*)\)/g)) g.push(m[1].includes("superAdmin") ? "super admin" : m[1].includes("allowWithoutMfa") ? "admin (MFA not required)" : "admin");
    if (/requireRecentAdminAuth/.test(src)) g.push("recent re-auth (super admin)");
    if (/requireUser\(/.test(src)) g.push("user");
    if (/getAdmin\(/.test(src) && !g.some((x) => x.startsWith("admin"))) g.push("admin session (checked in handler)");
    if (/getUser\(/.test(src) && !g.includes("user")) g.push("optional user");
    if (/requireFeature\(/.test(src)) g.push("plan feature");
    if (/verifyWebhookSignature|handleRazorpayWebhook/.test(src)) g.push("HMAC signature");
    if (/rateLimit\(/.test(src)) g.push("rate-limited");
    const guard = [...new Set(g)].join(", ") || "public";
    return { route, file: path.relative(ROOT, file).replace(/\\/g, "/"), methods, guard, purpose: API_PURPOSE[route] || "" };
  }).sort((a, b) => a.route.localeCompare(b.route));
}

function dirTree() {
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter(Boolean)
    .filter((f) => !f.startsWith("docs/mini-project-report/") && !/\.(db|sqlite)$/.test(f) && !f.startsWith("uploads/"));
  const tree = {};
  for (const f of files) { let n = tree; for (const part of f.split("/")) n = n[part] ??= {}; }
  tree.docs ??= {}; tree.docs["mini-project-report"] = { "(this report package)": {} };
  const lines = ["qrsathi/"];
  const walk = (n, pre) => {
    const keys = Object.keys(n).sort((a, b) => (Object.keys(n[b]).length > 0) - (Object.keys(n[a]).length > 0) || a.localeCompare(b));
    keys.forEach((k, i) => {
      const last = i === keys.length - 1, dir = Object.keys(n[k]).length > 0;
      lines.push(`${pre}${last ? "└── " : "├── "}${k}${dir ? "/" : ""}`);
      if (dir) walk(n[k], pre + (last ? "    " : "│   "));
    });
  };
  walk(tree, "");
  return { text: lines.join("\n"), count: files.length };
}

function screenshotRows() {
  const dir = path.join(R, "screenshots/desktop-1280");
  const used = {};
  for (const m of read(path.join(SRC, "06-implementation.md")).matchAll(/!\[(Figure [\d.]+):[^\]]*\]\(screenshots\/desktop-1280\/([^)]+)\)/g)) used[m[2]] = m[1];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort().map((f, i) => {
    const base = f.replace(/\.png$/, "");
    const route = base === "home" ? "/" : "/" + base.replace(/_/g, "/");
    return [String(i + 1), `desktop-1280/${f}`, fs.existsSync(path.join(R, "screenshots/mobile-375", f)) ? `mobile-375/${f}` : "—", route, used[f] || (base === "home" || base === "generator" || base === "scanner" ? "Figure 6.19 (mobile)" : "—")];
  });
}

export function generated() {
  const api = apiRoutes();
  const tcStatus = (s) => s;
  const dict = dictionaryMarkdown().replace(/^#### (\w+)\n/gm, (m, name) => `#### ${name}\n\nTable C.${models.findIndex((x) => x.name === name) + 1}: Data dictionary — ${name}\n`);
  const tree = dirTree();
  return {
    MODEL_SUMMARY: mdTable(["Model", "Scalar columns", "Unique constraints", "Secondary indexes", "Foreign keys to"], summaryRows().map((r) => [r.name, r.columns, r.uniques, r.indexes, r.fks.join(", ") || "—"])),
    DATA_DICTIONARY: dict,
    API_INVENTORY: "Table B.1: API endpoint inventory\n\n" + mdTable(["#", "Route", "Methods", "Guard", "Purpose", "Source"], api.map((a, i) => [i + 1, `\`${a.route}\``, a.methods.join(", ") || "GET", a.guard, a.purpose, `\`${a.file}\``])),
    TESTCASES_SUMMARY: mdTable(["ID", "Module", "Scenario", "Type", "Status"], TESTCASES.map((t) => [t[0], t[1], t[2], t[10], tcStatus(t[8])])),
    TESTCASES_FULL: "<!--landscape-->\n\nTable D.1: Detailed test cases\n\n" + mdTable(TC_COLUMNS.slice(0, 10), TESTCASES.map((t) => t.slice(0, 10))) + "\n\n<!--/landscape-->",
    FEATURE_MATRIX: mdTable(FEATURE_COLUMNS, FEATURES),
    RTM_FULL: "<!--landscape-->\n\nTable H.1: Requirement traceability matrix\n\n" + mdTable(RTM_COLUMNS, RTM) + "\n\n<!--/landscape-->",
    DIRTREE: `Files listed: ${tree.count} (tracked and untracked, excluding ignored files).\n\n\`\`\`text\n${tree.text}\n\`\`\``,
    SCREENSHOT_INDEX: "Table G.1: Screenshot index\n\n" + mdTable(["#", "Desktop file", "Mobile file", "Route", "Used in report"], screenshotRows()),
    API_COUNT: String(api.filter((a) => a.route.startsWith("/api/")).length),
    _api: api, _tree: tree,
  };
}

const fill = (md, g) => md.replace(/\[\[([A-Z_]+)\]\]/g, (m, k) => (k in g ? g[k] : m));

// ---------------------------------------------------------------- parse into blocks
const SIG = /^\[\[SIGNATURES:(.*)\]\]$/;
function blocksFrom(md, part) {
  const toks = marked.lexer(md);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.type === "space" || t.type === "hr") continue;
    if (t.type === "html") {
      if (/<!--landscape-->/.test(t.raw)) out.push({ type: "landscape", on: true });
      else if (/<!--\/landscape-->/.test(t.raw)) out.push({ type: "landscape", on: false });
      continue;
    }
    if (t.type === "heading") { out.push({ type: "h", level: t.depth, text: t.text, part }); continue; }
    if (t.type === "paragraph") {
      const sig = SIG.exec(t.text.trim());
      if (sig) { out.push({ type: "sig", parts: sig[1].split("|") }); continue; }
      const only = t.tokens.length === 1 && t.tokens[0].type === "image" ? t.tokens[0] : null;
      if (only && /^Figure /.test(only.text)) { out.push({ type: "figure", src: only.href, caption: only.text }); continue; }
      const cap = /^Table ([A-Z]?[\d.]+[a-z]?): (.+)$/.exec(t.text.trim());
      let j = i + 1; while (toks[j]?.type === "space") j++;
      if (cap && toks[j]?.type === "table") { out.push({ type: "table", caption: t.text.trim(), table: toks[j] }); i = j; continue; }
      out.push({ type: "p", tokens: t.tokens, raw: t.text }); continue;
    }
    if (t.type === "table") { out.push({ type: "table", caption: null, table: t }); continue; }
    if (t.type === "code") { out.push({ type: "code", text: t.text, lang: t.lang }); continue; }
    if (t.type === "list") { out.push({ type: "list", ordered: t.ordered, items: t.items }); continue; }
    if (t.type === "blockquote") { out.push({ type: "p", tokens: t.tokens.flatMap((x) => x.tokens || []), raw: t.text }); continue; }
    throw new Error(`Unhandled token ${t.type}`);
  }
  return out;
}

// ---------------------------------------------------------------- HTML / PDF
// Raw HTML in the Markdown (e.g. "<script>" quoted in a test case) is shown as text, never interpreted.
marked.use({ renderer: { html(token) { return esc(token.text ?? token.raw ?? ""); } } });
const inlineHtml = (s) => marked.parseInline(s);
function tableHtml(tok, cls = "") {
  const h = tok.header.map((c) => `<th>${inlineHtml(c.text)}</th>`).join("");
  const rows = tok.rows.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c.text)}</td>`).join("")}</tr>`).join("\n");
  return `<table class="${cls}"><thead><tr>${h}</tr></thead><tbody>${rows}</tbody></table>`;
}
const listHtml = (b) => `<${b.ordered ? "ol" : "ul"}>${b.items.map((it) => `<li>${inlineHtml(it.text)}</li>`).join("")}</${b.ordered ? "ol" : "ul"}>`;
const anchor = (n) => `a${n}`;
// Diagrams are rendered at 2x; anything wider than ~1000 CSS px goes on a landscape page.
const isWide = (src) => src.startsWith("diagrams/") && pngSize(path.join(R, src)).w / 2 > 1000;

function bodyHtml(blocks, { markers }) {
  let html = "", n = 0, inLand = false;
  const mk = (id) => (markers ? `<span class="mk">QXQ${id}QXQ</span>` : "");
  for (const b of blocks) {
    n++;
    if (b.type === "landscape") { html += b.on ? `<div class="landscape">` : `</div>`; inLand = b.on; continue; }
    if (b.type === "h") {
      const id = anchor(n); b.id = id;
      if (b.level === 1) {
        const m = /^Chapter (\d+): (.*)$/.exec(b.text);
        html += m ? `<h1 class="chapter" id="${id}">${mk(id)}<span class="chapno">CHAPTER ${m[1]}</span><br>${esc(m[2])}</h1>` : `<h1 class="chapter" id="${id}">${mk(id)}${esc(b.text)}</h1>`;
      } else html += `<h${b.level} id="${id}">${mk(id)}${inlineHtml(b.text)}</h${b.level}>`;
    } else if (b.type === "p") html += `<p>${inlineHtml(b.raw)}</p>`;
    else if (b.type === "figure") {
      b.id = anchor(n);
      const abs = path.join(R, b.src).replace(/\\/g, "/");
      const wide = !inLand && isWide(b.src);
      html += `${wide ? `<div class="landscape">` : ""}<figure id="${b.id}" class="${wide ? "wide" : ""}">${mk(b.id)}<img src="file:///${abs}" alt=""><figcaption>${esc(b.caption)}</figcaption></figure>${wide ? "</div>" : ""}`;
    } else if (b.type === "table") {
      if (b.caption) { b.id = anchor(n); html += `<div class="tcap" id="${b.id}">${mk(b.id)}${esc(b.caption)}</div>`; }
      html += tableHtml(b.table, inLand ? "land" : "");
    } else if (b.type === "code") html += `<pre>${esc(b.text)}</pre>`;
    else if (b.type === "list") html += listHtml(b);
    else if (b.type === "sig") {
      const [l1, l2, r1, r2] = b.parts;
      html += `<div class="sig"><div><div class="line"></div><b>${inlineHtml(l1)}</b><br>${inlineHtml(l2 || "")}</div><div><div class="line"></div><b>${inlineHtml(r1 || "")}</b><br>${inlineHtml(r2 || "")}</div></div>`;
    }
  }
  return html;
}

const CSS = `
@page { size: A4; margin: 24mm 20mm 22mm 30mm; }
@page land { size: A4 landscape; margin: 20mm 18mm 20mm 18mm; }
.landscape { page: land; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.45; color: #000; text-align: justify; hyphens: auto; }
h1, h2, h3, h4 { font-family: "Times New Roman", Times, serif; text-align: left; break-after: avoid; position: relative; }
h1.chapter { break-before: page; text-align: center; font-size: 18pt; margin: 0 0 18pt; line-height: 1.4; }
.chapno { font-size: 14pt; letter-spacing: 2px; }
h2 { font-size: 14pt; margin: 18pt 0 6pt; }
h3 { font-size: 12.5pt; margin: 14pt 0 4pt; }
h4 { font-size: 12pt; font-style: italic; margin: 12pt 0 4pt; }
p { margin: 0 0 8pt; }
ul, ol { margin: 0 0 8pt 18pt; padding: 0; } li { margin-bottom: 3pt; }
code { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; background: #f2f2f2; padding: 0 2px; overflow-wrap: anywhere; }
pre { font-family: Consolas, "Courier New", monospace; font-size: 8.4pt; line-height: 1.3; background: #f6f6f6; border: 1px solid #d0d0d0; padding: 6pt 8pt; white-space: pre-wrap; overflow-wrap: anywhere; text-align: left; margin: 0 0 10pt; }
table { border-collapse: collapse; width: 100%; margin: 0 0 12pt; font-size: 9.5pt; line-height: 1.25; text-align: left; }
table.land { font-size: 7.6pt; }
th, td { border: 0.6pt solid #777; padding: 3pt 4pt; vertical-align: top; overflow-wrap: break-word; hyphens: manual; }
td code { word-break: break-all; }
figure.wide img { max-height: 150mm; }
th { background: #e6e6e6; font-weight: bold; }
thead { display: table-header-group; } tr { break-inside: avoid; }
td code, th code { font-size: 8pt; background: none; padding: 0; }
.tcap { font-weight: bold; font-size: 10.5pt; margin: 10pt 0 4pt; text-align: left; break-after: avoid; position: relative; }
figure { margin: 10pt 0 14pt; text-align: center; break-inside: avoid; position: relative; }
figure img { max-width: 100%; max-height: 205mm; object-fit: contain; }
figcaption { font-weight: bold; font-size: 10.5pt; margin-top: 5pt; }
.mk { position: absolute; left: 0; top: 0; font-size: 2px; color: #fff; }
.sig { display: flex; justify-content: space-between; margin: 34pt 0 10pt; gap: 40pt; }
.sig > div { width: 45%; text-align: center; font-size: 11pt; } .sig .line { border-top: 0.8pt solid #000; margin-bottom: 4pt; }
.front h1 { break-before: page; text-align: center; font-size: 16pt; margin-bottom: 16pt; }
.toc { width: 100%; border: none; font-size: 11pt; }
.toc td { border: none; padding: 1.5pt 0; } .toc td.pg { text-align: right; width: 12mm; } .toc .l1 td { font-weight: bold; padding-top: 5pt; }
.toc .l2 td:first-child { padding-left: 8mm; } .toc .l3 td:first-child { padding-left: 16mm; font-size: 10.5pt; }
.toc a { color: #000; text-decoration: none; }
.cover { height: 245mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; break-after: page; }
.cover .t1 { font-size: 30pt; font-weight: bold; letter-spacing: 1px; margin-top: 18mm; }
.cover .t2 { font-size: 17pt; margin-top: 6pt; } .cover .t3 { font-size: 13pt; font-style: italic; margin-top: 16pt; }
.cover .logo { width: 34mm; height: 34mm; border: 1pt dashed #888; display: flex; align-items: center; justify-content: center; font-size: 9pt; color: #555; margin: 0 auto; }
.cover .who { font-size: 13pt; line-height: 1.6; }
`;

function coverHtml() {
  const m = META;
  const cover = `<div class="cover"><div><div class="t1">${m.title}</div><div class="t2">${esc(m.subtitle)}</div><div class="t3">${m.kind}</div>
  <div style="margin-top:14pt;font-size:12.5pt">submitted in partial fulfilment of the requirements for the award of the degree of<br><b>${esc(m.degree)}</b></div></div>
  <div class="who">Submitted by<br><b>${esc(m.student)}</b><br>Roll No. ${esc(m.roll)}<br><br>Under the guidance of<br><b>${esc(m.guide)}</b>, ${esc(m.guideDesignation)}</div>
  <div><div class="logo">[Institution logo]</div><div style="margin-top:8pt;font-size:13pt"><b>${esc(m.department)}</b><br>${esc(m.institution)}<br>${esc(m.university)}<br>${esc(m.place)}<br>${esc(m.monthYear)}</div></div></div>`;
  const title = `<div class="cover"><div><div style="font-size:13pt;margin-top:10mm">${m.kind} on</div><div class="t1" style="margin-top:8mm">${m.title}</div><div class="t2">${esc(m.subtitle)}</div></div>
  <div class="who" style="font-size:12pt">A full-stack web application for generating QR codes and barcodes,<br>managing products and stock, and administering subscriptions,<br>built with Next.js, TypeScript and Prisma</div>
  <div class="who">by<br><b>${esc(m.student)}</b> (${esc(m.roll)})<br><br>Guide: <b>${esc(m.guide)}</b></div>
  <div style="font-size:12.5pt"><b>${esc(m.department)}</b><br>${esc(m.institution)}<br>${esc(m.university)}<br>Academic year ${esc(m.academicYear)}</div></div>`;
  return cover + title;
}

function listsHtml(entries, pages) {
  const toc = entries.headings.map((h) => `<tr class="l${h.level}"><td><a href="#${h.id}">${esc(h.text.replace(/^Chapter (\d+): /, "Chapter $1 — "))}</a></td><td class="pg">${pages[h.id] ?? ""}</td></tr>`).join("");
  const lof = entries.figures.map((f) => `<tr><td>${esc(f.caption)}</td><td class="pg">${pages[f.id] ?? ""}</td></tr>`).join("");
  const lot = entries.tables.map((t) => `<tr><td>${esc(t.caption)}</td><td class="pg">${pages[t.id] ?? ""}</td></tr>`).join("");
  return `<h1>Table of Contents</h1><table class="toc">${toc}</table><h1>List of Figures</h1><table class="toc">${lof}</table><h1>List of Tables</h1><table class="toc">${lot}</table>`;
}

function page(html) { return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`; }

async function pdfFrom(browser, html, file) {
  const p = await browser.newPage();
  const f = path.join(TMP, file + ".html");
  fs.writeFileSync(f, page(html));
  await p.goto("file:///" + f.replace(/\\/g, "/"), { waitUntil: "networkidle0" });
  const buf = await p.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  await p.close();
  return buf;
}

async function markerPages(buf) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  const pages = {};
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    const text = tc.items.map((x) => x.str).join("");
    for (const m of text.matchAll(/QXQ(a\d+)QXQ/g)) pages[m[1]] ??= i;
  }
  return { pages, count: doc.numPages };
}

const roman = (n) => { const t = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]; let s = ""; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s; };

async function stamp(doc, startIndex, count, { numbering, header }) {
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const pages = doc.getPages();
  for (let k = 0; k < count; k++) {
    const pg = pages[startIndex + k];
    const { width, height } = pg.getSize();
    const label = numbering === "roman" ? roman(k + 1) : String(k + 1);
    const lw = font.widthOfTextAtSize(label, 10);
    pg.drawText(label, { x: width / 2 - lw / 2, y: 28, size: 10, font, color: rgb(0, 0, 0) });
    if (header) {
      const hw = font.widthOfTextAtSize(header, 9);
      pg.drawText(header, { x: width - 56 - hw, y: height - 40, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
      pg.drawLine({ start: { x: 56, y: height - 45 }, end: { x: width - 56, y: height - 45 }, thickness: 0.4, color: rgb(0.6, 0.6, 0.6) });
    }
  }
}

async function buildPdf(front, body, entries, outFile) {
  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true });
  try {
    const pass1 = await pdfFrom(browser, bodyHtml(body, { markers: true }), "body-pass1");
    const { pages } = await markerPages(pass1);
    const bodyPdf = await pdfFrom(browser, bodyHtml(body, { markers: false }), "body");
    // Front matter: certificate, declaration, acknowledgement, abstract, TOC/LOF/LOT, abbreviations.
    const fb = front.map((b) => b);
    const idx = fb.findIndex((b) => b.type === "h" && /Abbreviations/.test(b.text));
    const frontHtml = `<div class="front">${bodyHtml(fb.slice(0, idx), { markers: false })}${listsHtml(entries, pages)}${bodyHtml(fb.slice(idx), { markers: false })}</div>`;
    const frontPdf = await pdfFrom(browser, frontHtml.replace(/class="chapter"/g, ""), "front");
    const coverPdf = await pdfFrom(browser, coverHtml(), "cover");
    const out = await PDFDocument.create();
    const add = async (buf) => { const src = await PDFDocument.load(buf); const ps = await out.copyPages(src, src.getPageIndices()); ps.forEach((p) => out.addPage(p)); return ps.length; };
    const nCover = await add(coverPdf);
    const nFront = await add(frontPdf);
    const nBody = await add(bodyPdf);
    await stamp(out, nCover, nFront, { numbering: "roman" });
    await stamp(out, nCover + nFront, nBody, { numbering: "arabic", header: META.header });
    out.setTitle(`${META.title} — ${META.subtitle}`); out.setAuthor(META.student); out.setSubject("Mini Project Report"); out.setCreator("QRSathi report build (Chromium + pdf-lib)");
    fs.writeFileSync(outFile, await out.save());
    return { pages: nCover + nFront + nBody, nCover, nFront, nBody, located: Object.keys(pages).length };
  } finally { await browser.close(); }
}

// ---------------------------------------------------------------- DOCX
const TW = 9070, TW_LAND = 13900; // text widths in DXA for portrait (30/20 mm margins) and landscape
function pngSize(file) { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b }; }
function runs(tokens, base = {}) {
  const out = [];
  for (const t of tokens || []) {
    if (t.type === "text" || t.type === "escape") { if (t.tokens?.length) out.push(...runs(t.tokens, base)); else out.push(new D.TextRun({ text: decode(t.text), ...base })); }
    else if (t.type === "strong") out.push(...runs(t.tokens, { ...base, bold: true }));
    else if (t.type === "em") out.push(...runs(t.tokens, { ...base, italics: true }));
    else if (t.type === "codespan") out.push(new D.TextRun({ text: decode(t.text), ...base, font: "Consolas", size: base.size ? base.size - 2 : 20 }));
    else if (t.type === "link") out.push(...runs(t.tokens, base));
    else if (t.type === "br") out.push(new D.TextRun({ break: 1 }));
    else if (t.type === "html") { const s = decode(t.text); if (s) out.push(new D.TextRun({ text: s, ...base })); }
    else if (t.type === "del") out.push(...runs(t.tokens, { ...base, strike: true }));
    else if (t.raw) out.push(new D.TextRun({ text: decode(t.raw), ...base }));
  }
  return out;
}
const decode = (s) => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
const inlineRuns = (text, base) => runs(marked.Lexer.lexInline(String(text ?? "")), base);

function docxTable(tok, width, small) {
  const cols = tok.header.length;
  const lens = tok.header.map((h, i) => Math.max(h.text.length, ...tok.rows.map((r) => Math.min(60, (r[i]?.text || "").length))));
  const minW = Math.min(1000, width / cols);
  let w = lens.map((l) => Math.max(minW, Math.sqrt(l + 4)));
  const sum = w.reduce((a, b) => a + b, 0);
  w = w.map((x) => Math.floor((x / sum) * width));
  w[w.length - 1] += width - w.reduce((a, b) => a + b, 0);
  const size = small ? 15 : 18;
  const border = { style: D.BorderStyle.SINGLE, size: 4, color: "808080" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const mk = (c, i, head) => new D.TableCell({
    width: { size: w[i], type: D.WidthType.DXA }, borders,
    shading: head ? { type: D.ShadingType.CLEAR, color: "auto", fill: "E6E6E6" } : undefined,
    margins: { top: 40, bottom: 40, left: 70, right: 70 },
    children: [new D.Paragraph({ spacing: { after: 0, line: 240 }, children: inlineRuns(c.text, { size, bold: head || undefined }) })],
  });
  return new D.Table({
    width: { size: width, type: D.WidthType.DXA }, columnWidths: w,
    rows: [new D.TableRow({ tableHeader: true, children: tok.header.map((c, i) => mk(c, i, true)) }), ...tok.rows.map((r) => new D.TableRow({ cantSplit: true, children: r.map((c, i) => mk(c, i, false)) }))],
  });
}

function docxBlocks(blocks, { front = false } = {}) {
  const sections = []; let cur = []; let land = false; let listN = 0;
  const flush = (orientation) => { if (cur.length) sections.push({ children: cur, landscape: orientation }); cur = []; };
  const brk = () => cur.length > 0; // a new section already starts on a new page
  for (const b of blocks) {
    if (b.type === "landscape") { flush(land); land = b.on; continue; }
    const width = land ? TW_LAND : TW;
    if (b.type === "h") {
      if (b.level === 1) {
        const m = /^Chapter (\d+): (.*)$/.exec(b.text);
        if (front) cur.push(new D.Paragraph({ style: "FrontHeading", pageBreakBefore: brk(), children: [new D.TextRun(b.text)] }));
        else cur.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, pageBreakBefore: brk(), alignment: D.AlignmentType.CENTER, children: m ? [new D.TextRun({ text: `CHAPTER ${m[1]}` }), new D.TextRun({ break: 1, text: m[2] })] : [new D.TextRun(b.text)] }));
      } else cur.push(new D.Paragraph({ heading: [0, 0, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4][b.level], children: inlineRuns(b.text) }));
    } else if (b.type === "p") cur.push(new D.Paragraph({ alignment: D.AlignmentType.JUSTIFIED, spacing: { after: 140, line: 336 }, children: runs(b.tokens) }));
    else if (b.type === "figure") {
      const img = pngSize(path.join(R, b.src));
      const wide = !land && isWide(b.src);
      if (wide) flush(land);
      const L = land || wide;
      const maxW = (L ? 9.4 : 6.2) * 96, maxH = (L ? 5.6 : 8.2) * 96;
      const s = Math.min(maxW / (img.w / 2), maxH / (img.h / 2), 1.6);
      cur.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, keepNext: true, spacing: { before: 120 }, children: [new D.ImageRun({ type: "png", data: img.data, transformation: { width: Math.round((img.w / 2) * s), height: Math.round((img.h / 2) * s) } })] }));
      cur.push(new D.Paragraph({ style: "FigureCaption", alignment: D.AlignmentType.CENTER, spacing: { after: 240 }, children: [new D.TextRun(b.caption)] }));
      if (wide) flush(true);
    } else if (b.type === "table") {
      if (b.caption) cur.push(new D.Paragraph({ style: "TableCaption", keepNext: true, children: [new D.TextRun(b.caption)] }));
      cur.push(docxTable(b.table, width, land));
      cur.push(new D.Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (b.type === "code") {
      const lines = b.text.split("\n");
      lines.forEach((l, i) => cur.push(new D.Paragraph({ shading: { type: D.ShadingType.CLEAR, color: "auto", fill: "F4F4F4" }, spacing: { after: i === lines.length - 1 ? 160 : 0, line: 240 }, keepLines: true, children: [new D.TextRun({ text: l || " ", font: "Consolas", size: 16 })] })));
    } else if (b.type === "list") {
      listN++;
      for (const it of b.items) cur.push(new D.Paragraph({ numbering: { reference: b.ordered ? "numbered" : "bullets", level: 0, instance: b.ordered ? listN : 0 }, spacing: { after: 60, line: 300 }, alignment: D.AlignmentType.LEFT, children: inlineRuns(it.text) }));
    } else if (b.type === "sig") {
      const [l1, l2, r1, r2] = b.parts;
      const c = (a, z) => new D.TableCell({ width: { size: TW / 2, type: D.WidthType.DXA }, borders: { top: { style: D.BorderStyle.NONE }, bottom: { style: D.BorderStyle.NONE }, left: { style: D.BorderStyle.NONE }, right: { style: D.BorderStyle.NONE } }, children: [
        new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 700 }, border: { top: { style: D.BorderStyle.SINGLE, size: 6, color: "000000", space: 4 } }, children: inlineRuns(a, { bold: true }) }),
        new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: inlineRuns(z || " ") })] });
      cur.push(new D.Table({ width: { size: TW, type: D.WidthType.DXA }, columnWidths: [TW / 2, TW / 2], rows: [new D.TableRow({ children: [c(l1, l2), c(r1 || " ", r2)] })] }));
    }
  }
  flush(land);
  return sections;
}

function docxCover() {
  const m = META, P = (text, o = {}) => new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: o.after ?? 120, before: o.before ?? 0 }, children: [new D.TextRun({ text, size: o.size ?? 26, bold: o.bold, italics: o.italics })] });
  return [
    P(m.title, { size: 60, bold: true, before: 600 }), P(m.subtitle, { size: 34 }), P(m.kind, { size: 26, italics: true, before: 200 }),
    P("submitted in partial fulfilment of the requirements for the award of the degree of", { before: 300 }), P(m.degree, { bold: true }),
    P("Submitted by", { before: 600 }), P(m.student, { bold: true }), P(`Roll No. ${m.roll}`),
    P("Under the guidance of", { before: 300 }), P(`${m.guide}, ${m.guideDesignation}`, { bold: true }),
    P("[Institution logo]", { before: 600, italics: true, size: 20 }),
    P(m.department, { bold: true, before: 200 }), P(m.institution), P(m.university), P(m.place), P(m.monthYear),
    new D.Paragraph({ children: [new D.PageBreak()] }),
    P(`${m.kind} on`, { before: 600 }), P(m.title, { size: 56, bold: true, before: 200 }), P(m.subtitle, { size: 32 }),
    P("A full-stack web application for generating QR codes and barcodes, managing products and stock, and administering subscriptions, built with Next.js, TypeScript and Prisma", { before: 500, size: 24 }),
    P("by", { before: 500 }), P(`${m.student} (${m.roll})`, { bold: true }), P(`Guide: ${m.guide}`, { before: 200 }),
    P(m.department, { bold: true, before: 900 }), P(m.institution), P(m.university), P(`Academic year ${m.academicYear}`),
  ];
}

async function buildDocx(front, body, outFile) {
  const header = new D.Header({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ text: META.header, size: 18, color: "595959" })] })] });
  const footer = new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ children: [D.PageNumber.CURRENT], size: 20 })] })] });
  const portrait = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1360, bottom: 1250, left: 1700, right: 1134, header: 700, footer: 600 } } };
  const landscape = { page: { size: { width: 11906, height: 16838, orientation: D.PageOrientation.LANDSCAPE }, margin: { top: 1134, bottom: 1134, left: 1020, right: 1020, header: 600, footer: 500 } } };
  const idx = front.findIndex((b) => b.type === "h" && /Abbreviations/.test(b.text));
  const frontA = docxBlocks(front.slice(0, idx), { front: true }).flatMap((s) => s.children);
  const frontB = docxBlocks(front.slice(idx), { front: true }).flatMap((s) => s.children);
  frontB.unshift(new D.Paragraph({ children: [new D.PageBreak()] }));
  const H1 = (t) => new D.Paragraph({ style: "FrontHeading", pageBreakBefore: true, children: [new D.TextRun(t)] });
  const note = new D.Paragraph({ spacing: { after: 160 }, children: [new D.TextRun({ text: "Right-click and choose “Update Field” (or press F9) if page numbers are not shown.", italics: true, size: 18, color: "595959" })] });
  const lists = [
    H1("Table of Contents"), note, new D.TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
    H1("List of Figures"), new D.TableOfContents("List of Figures", { hyperlink: true, stylesWithLevels: [new D.StyleLevel("FigureCaption", 1)] }),
    H1("List of Tables"), new D.TableOfContents("List of Tables", { hyperlink: true, stylesWithLevels: [new D.StyleLevel("TableCaption", 1)] }),
  ];
  const bodySecs = docxBlocks(body);
  const doc = new D.Document({
    creator: META.student, title: `${META.title} — ${META.subtitle}`, description: "Mini Project Report",
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: "Times New Roman", size: 24 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 34, bold: true, font: "Times New Roman" }, paragraph: { spacing: { before: 240, after: 360 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, font: "Times New Roman" }, paragraph: { spacing: { before: 300, after: 120 }, keepNext: true, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 25, bold: true, font: "Times New Roman" }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, outlineLevel: 2 } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, italics: true, font: "Times New Roman" }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 3 } },
        { id: "FrontHeading", name: "Front Heading", basedOn: "Normal", next: "Normal", run: { size: 32, bold: true }, paragraph: { alignment: D.AlignmentType.CENTER, spacing: { after: 300 } } },
        { id: "FigureCaption", name: "FigureCaption", basedOn: "Normal", next: "Normal", run: { size: 21, bold: true } },
        { id: "TableCaption", name: "TableCaption", basedOn: "Normal", next: "Normal", run: { size: 21, bold: true }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true } },
      ],
    },
    numbering: { config: [
      { reference: "bullets", levels: [{ level: 0, format: D.LevelFormat.BULLET, text: "•", alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: "numbered", levels: [{ level: 0, format: D.LevelFormat.DECIMAL, text: "%1.", alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
    ] },
    sections: [
      { properties: { ...portrait }, children: docxCover() },
      { properties: { ...portrait, type: D.SectionType.NEXT_PAGE, page: { ...portrait.page, pageNumbers: { start: 1, formatType: D.NumberFormat.LOWER_ROMAN } } }, footers: { default: footer }, children: [...frontA, ...lists, ...frontB] },
      ...bodySecs.map((s, i) => ({
        properties: { ...(s.landscape ? landscape : portrait), type: D.SectionType.NEXT_PAGE, page: { ...(s.landscape ? landscape : portrait).page, ...(i === 0 ? { pageNumbers: { start: 1, formatType: D.NumberFormat.DECIMAL } } : {}) } },
        headers: { default: header }, footers: { default: footer }, children: s.children,
      })),
    ],
  });
  fs.writeFileSync(outFile, await D.Packer.toBuffer(doc));
}


// ---------------------------------------------------------------- XLSX
async function buildXlsx(outFile, g) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QRSathi report build"; wb.created = new Date();
  const sheet = (name, cols, rows, widths) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map((c, i) => ({ header: c, key: "c" + i, width: widths?.[i] ?? 22 }));
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
    ws.eachRow((row) => row.eachCell((c) => { c.alignment = { wrapText: true, vertical: "top" }; c.border = { top: { style: "thin", color: { argb: "FFBFBFBF" } }, bottom: { style: "thin", color: { argb: "FFBFBFBF" } } }; }));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return ws;
  };
  const statusFill = { Verified: "FFE2F0D9", Pass: "FFE2F0D9", Fail: "FFF8D7DA", "Not executed": "FFFFF3CD" };
  const rtm = sheet("RTM", RTM_COLUMNS, RTM, [12, 46, 16, 48, 28, 20, 40]);
  rtm.eachRow((row, i) => { if (i > 1) { const v = String(row.getCell(6).value); const k = v.startsWith("Verified") ? "Verified" : v.startsWith("Not") || v.startsWith("Implemented") ? "Not executed" : v.startsWith("Partially") ? "Not executed" : null; if (k) row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill[k] } }; } });
  const tc = sheet("Test Cases", TC_COLUMNS, TESTCASES, [12, 13, 36, 22, 34, 22, 28, 30, 12, 50, 18]);
  tc.eachRow((row, i) => { if (i > 1) { const v = String(row.getCell(9).value); if (statusFill[v]) row.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill[v] } }; } });
  sheet("Feature Matrix", FEATURE_COLUMNS, FEATURES, [32, 36, 46, 30, 34, 40]);
  sheet("Defects", DEFECT_COLUMNS, DEFECTS, [8, 10, 16, 50, 46, 34, 50, 26]);
  sheet("API Inventory", ["Route", "Methods", "Guard", "Purpose", "Source"], g._api.map((a) => [a.route, a.methods.join(", ") || "GET", a.guard, a.purpose, a.file]), [36, 18, 34, 60, 50]);
  const counts = TESTCASES.reduce((o, t) => ((o[t[8]] = (o[t[8]] || 0) + 1), o), {});
  const rc = RTM.reduce((o, r) => ((o[r[5]] = (o[r[5]] || 0) + 1), o), {});
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ width: 44 }, { width: 18 }];
  [["QRSathi — Requirement Traceability Matrix", ""], ["Generated", new Date().toISOString().slice(0, 10)], ["Code snapshot", "HEAD 9b5dae7 + uncommitted changes (2026-10-25 18:41 IST)"], ["", ""], ["Requirements (FR + NFR)", RTM.length],
    ...Object.entries(rc).map(([k, v]) => [`  ${k}`, v]), ["", ""], ["Test cases", TESTCASES.length], ...Object.entries(counts).map(([k, v]) => [`  ${k}`, v]), ["", ""], ["Defects", DEFECTS.length]].forEach((r) => sum.addRow(r));
  sum.getRow(1).font = { bold: true, size: 14 };
  wb.views = [{ activeTab: 0 }];
  await wb.xlsx.writeFile(outFile);
}

// ---------------------------------------------------------------- mobile montage
async function montage() {
  const out = path.join(R, "screenshots/mobile-montage.png");
  const imgs = ["home", "generator", "scanner"].map((n) => "file:///" + path.join(R, "screenshots/mobile-375", n + ".png").replace(/\\/g, "/"));
  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true });
  const p = await browser.newPage();
  await p.setViewport({ width: 1215, height: 820, deviceScaleFactor: 1 });
  await p.setContent(`<body style="margin:0;background:#fff;display:flex;gap:15px;padding:10px">${imgs.map((s) => `<img src="${s}" style="width:375px;border:1px solid #999">`).join("")}</body>`, { waitUntil: "load" });
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewport({ width: 1180, height: h, deviceScaleFactor: 1 });
  await p.screenshot({ path: out, fullPage: true });
  await browser.close();
}

// ---------------------------------------------------------------- main
async function main() {
  const g = generated();
  const files = fs.readdirSync(SRC).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
  const front = blocksFrom(fill(read(path.join(SRC, files[0])), g), "front");
  const body = blocksFrom(files.slice(1).map((f) => fill(read(path.join(SRC, f)), g)).join("\n\n"), "body");
  for (const b of body) if (b.type === "figure" && !fs.existsSync(path.join(R, b.src)) && !b.src.includes("mobile-montage")) throw new Error("Missing image " + b.src);
  if (!fs.existsSync(path.join(R, "screenshots/mobile-montage.png")) || process.env.MONTAGE) await montage();
  const leftover = JSON.stringify(body.filter((b) => b.type === "p").map((b) => b.raw)).match(/\[\[[A-Z_]+\]\]/);
  if (leftover) throw new Error("Unfilled placeholder " + leftover[0]);

  // assign ids for lists
  let n = 0; for (const b of body) { n++; if (["h", "figure", "table"].includes(b.type)) b.id = anchor(n); }
  const entries = {
    headings: body.filter((b) => b.type === "h" && b.level <= 3),
    figures: body.filter((b) => b.type === "figure"),
    tables: body.filter((b) => b.type === "table" && b.caption),
  };
  // Re-run bodyHtml ids in the same order (bodyHtml assigns a(n) by block index too).
  const pdfInfo = await buildPdf(front, body, entries, path.join(R, "QRSathi_Mini_Project_Report.pdf"));
  await buildDocx(front, body, path.join(R, "QRSathi_Mini_Project_Report.docx"));
  await buildXlsx(path.join(R, "QRSathi_Requirement_Traceability_Matrix.xlsx"), g);

  // standalone Markdown documents
  const sd = path.join(SRC, "standalone");
  const written = [];
  if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd).filter((x) => x.endsWith(".md"))) {
    const target = path.join(R, f);
    fs.writeFileSync(target, fill(read(path.join(sd, f)), {
      ...g,
      TESTCASES_TABLE: mdTable(TC_COLUMNS, TESTCASES),
      FEATURE_TABLE: mdTable(FEATURE_COLUMNS, FEATURES),
      DEFECT_TABLE: mdTable(DEFECT_COLUMNS, DEFECTS),
      RTM_TABLE: mdTable(RTM_COLUMNS, RTM),
      API_TABLE: mdTable(["#", "Route", "Methods", "Guard", "Purpose", "Source"], g._api.map((a, i) => [i + 1, `\`${a.route}\``, a.methods.join(", ") || "GET", a.guard, a.purpose, `\`${a.file}\``])),
    }));
    written.push(f);
  }

  // verification
  const docxText = (await mammoth.extractRawText({ path: path.join(R, "QRSathi_Mini_Project_Report.docx") })).value;
  const chapters = [1, 2, 3, 4, 5, 6, 7].map((i) => docxText.includes(`CHAPTER ${i}`));
  const report = {
    built: new Date().toISOString(), pdf: pdfInfo,
    docx: { chapters, appendices: ["Appendix A", "Appendix B", "Appendix C", "Appendix D", "Appendix E", "Appendix F", "Appendix G", "Appendix H", "Appendix I"].map((a) => docxText.includes(a)), characters: docxText.length },
    counts: { headings: entries.headings.length, figures: entries.figures.length, tables: entries.tables.length, testcases: TESTCASES.length, requirements: RTM.length, apiRoutes: g._api.length },
    standalone: written,
  };
  fs.writeFileSync(path.join(R, "build", "build-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
