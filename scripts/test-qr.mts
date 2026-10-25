/**
 * Renders QR codes in every module/eye/frame style, rasterises them with sharp
 * and decodes them with jsQR to prove the output is scannable.
 * Run: npm run test:qr
 */
import sharp from "sharp";
import jsQR from "jsqr";
import { renderQr, DEFAULT_DESIGN, type QrDesign } from "../src/lib/qr-render";
import { QR_TYPES, validateContent, buildPayload } from "../src/lib/qr-types";
import { buildUpiUri, parseUpiUri } from "../src/lib/upi";

const LOGO =
  "data:image/svg+xml;base64," +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#e11d48"/></svg>').toString("base64");

async function decode(svg: string) {
  // Like a phone camera, try a few resolutions before giving up.
  for (const px of [700, 520, 960, 400]) {
    const got = await decodeAt(svg, px);
    if (got) return got;
  }
  return null;
}

async function decodeAt(svg: string, px: number) {
  const { data, info } = await sharp(Buffer.from(svg), { density: 300 })
    .resize(px, null, { fit: "inside" })
    .flatten({ background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const r = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { inversionAttempts: "attemptBoth" });
  return r?.data ?? null;
}

const cases: [string, Partial<QrDesign>][] = [];
for (const moduleStyle of ["square", "rounded", "dots", "diamond", "fluid", "bars"] as const)
  for (const eyeOuter of ["square", "rounded", "circle", "leaf"] as const)
    cases.push([`${moduleStyle}/${eyeOuter}`, { moduleStyle, eyeOuter, eyeInner: eyeOuter === "circle" ? "circle" : "rounded" }]);
cases.push(["gradient+logo+banner", { gradient: { ...DEFAULT_DESIGN.gradient, enabled: true, from: "#1e3a8a", to: "#7e22ce" }, logo: LOGO, frame: "banner", textAbove: "Hello" }]);
cases.push(["radial+bubble+pattern", { gradient: { ...DEFAULT_DESIGN.gradient, enabled: true, type: "radial", from: "#0f172a", to: "#0e7490" }, frame: "bubble", pattern: "dots" }]);
cases.push(["badge+leaf+eyeColor", { frame: "badge", eyeOuter: "leaf", eyeInner: "leaf", eyeColor: "#be123c", frameColor: "#111827" }]);
cases.push(["banner-top+outline text", { frame: "banner-top", textBelow: "www.example.com" }]);
cases.push(["outline+fluid+circle eyes", { frame: "outline", eyeOuter: "circle", eyeInner: "circle", moduleStyle: "fluid" }]);

let fail = 0;
const payloads = [
  "https://example.com/some/path?x=1",
  buildUpiUri({ pa: "shop@okaxis", pn: "Sharma General Store", am: "250", tn: "Order 1024" }),
];
for (const payload of payloads) {
  for (const [name, design] of cases) {
    const r = renderQr(payload, { ...DEFAULT_DESIGN, ...design });
    const got = await decode(r.svg);
    const ok = got === payload;
    if (!ok) { fail++; if (process.env.QR_DEBUG_DIR) await sharp(Buffer.from(r.svg)).resize(500).png().toFile(process.env.QR_DEBUG_DIR + "/" + name.replace(/[^a-z0-9]+/gi, "_") + ".png"); }
    console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(28)} v${r.version} ecc=${r.ecc}${ok ? "" : `  got=${got}`}`);
  }
}

// every content type builds a payload that encodes and decodes
const samples: Record<string, any> = {
  url: { url: "example.com" }, dynamic: { url: "https://example.com" }, text: { text: "Namaste 🙏" },
  vcard: { firstName: "Asha", lastName: "Rao", org: "Rao & Co", title: "", mobile: "+91 98765 43210", phone: "", email: "asha@example.com", website: "", street: "", city: "Pune", state: "MH", zip: "411001", country: "India", note: "" },
  phone: { phone: "+91 98765 43210" }, sms: { phone: "+919876543210", message: "Hi" }, email: { to: "a@b.in", subject: "Hello there", body: "Line" },
  wifi: { ssid: "Cafe;WiFi", password: "pass:word1", security: "WPA", hidden: false },
  whatsapp: { phone: "+91 98765 43210", message: "Hi there" }, instagram: { username: "@brand" }, facebook: { page: "brand" },
  tiktok: { username: "@brand.in" }, x: { handle: "brand_in" }, telegram: { username: "@brandchannel" }, snapchat: { username: "brand-in" },
  spotify: { url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" },
  youtube: { target: "@channel" }, linkedin: { kind: "in", handle: "asha-rao" }, maps: { mode: "coords", query: "", lat: "18.92", lng: "72.83" },
  upi: { vpa: "shop@okaxis", name: "Shop", amount: "", note: "", mc: "", tr: "" },
  bank: { format: "upi", name: "Asha Rao", account: "123456789012", ifsc: "sbin0001234", bankName: "", amount: "100", note: "" },
  product: { delivery: "link", link: "https://example.com/p", name: "", price: "", sku: "", description: "", imageUrl: "", buyUrl: "" },
  file: { fileKind: "pdf", url: "https://example.com/a.pdf" },
  event: { title: "Launch", start: "2026-11-01T10:00", end: "2026-11-01T12:00", location: "Delhi", description: "" },
  app: { delivery: "link", appName: "", android: "https://play.google.com/store/apps/details?id=x", ios: "", fallback: "" },
  links: { title: "Me", bio: "", avatarUrl: "", color: "#4f46e5", links: [{ label: "Site", url: "example.com" }] },
  menu: { delivery: "page", link: "", restaurant: "Dhaba", tagline: "", color: "#ea580c", items: [{ category: "Main", name: "Dal", price: "120", description: "" }] },
  business: { name: "Biz", tagline: "", description: "", logoUrl: "", phone: "", whatsapp: "", email: "", website: "", address: "", hours: "", color: "#0f766e" },
  feedback: { delivery: "link", reviewUrl: "https://g.page/r/x/review", business: "", question: "", feedbackEmail: "" },
  coupon: { business: "Biz", offer: "20% OFF", code: "X", validUntil: "", description: "", terms: "", redeemUrl: "", color: "#db2777" },
  landing: { title: "Hi", subtitle: "", imageUrl: "", body: "", ctaLabel: "", ctaUrl: "", color: "#7c3aed" },
};
for (const t of QR_TYPES) {
  const v = validateContent(t, samples[t.id]);
  if (!v.ok) { fail++; console.log(`FAIL  type ${t.id} validation`, v.errors); continue; }
  const payload = buildPayload(t, v.data!, { hostedUrl: "https://qr.example/p/abc1234" });
  const got = await decode(renderQr(payload, DEFAULT_DESIGN).svg);
  const ok = got === payload;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  type ${t.id.padEnd(10)} ${JSON.stringify(payload).slice(0, 90)}`);
}

// social profile types: exact payloads, and links to other sites are refused
const social: [string, Record<string, string>, string | null][] = [
  ["tiktok", { username: "@brand.in" }, "https://www.tiktok.com/@brand.in"],
  ["tiktok", { username: "https://www.tiktok.com/@brand.in" }, "https://www.tiktok.com/@brand.in"],
  ["tiktok", { username: "evil.com/tiktok.com/@x" }, null],
  ["x", { handle: "@brand_in" }, "https://x.com/brand_in"],
  ["x", { handle: "twitter.com/brand_in" }, "https://twitter.com/brand_in"],
  ["x", { handle: "this_handle_is_too_long" }, null],
  ["telegram", { username: "brandchannel" }, "https://t.me/brandchannel"],
  ["telegram", { username: "t.me/brandchannel" }, "https://t.me/brandchannel"],
  ["telegram", { username: "abc" }, null],
  ["snapchat", { username: "brand-in" }, "https://www.snapchat.com/add/brand-in"],
  ["snapchat", { username: "https://snapchat.com.evil.io/add/x" }, null],
  ["spotify", { url: "open.spotify.com/artist/abc" }, "https://open.spotify.com/artist/abc"],
  ["spotify", { url: "https://example.com/spotify" }, null],
];
for (const [id, data, want] of social) {
  const t = QR_TYPES.find((x) => x.id === id)!;
  const v = validateContent(t, data);
  const got = v.ok ? buildPayload(t, v.data!, { hostedUrl: "" }) : null;
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${JSON.stringify(Object.values(data)[0])} -> ${got ?? "rejected"}`);
}

// UPI round trip + validation negatives
const u = parseUpiUri(buildUpiUri({ pa: "a.b@ybl", pn: "A & B Stores", am: "99.5", tn: "Tea + snacks" }));
const upiOk = u?.pa === "a.b@ybl" && u.pn === "A & B Stores" && u.am === "99.50" && u.tn === "Tea + snacks";
console.log(`${upiOk ? "PASS" : "FAIL"}  upi round-trip`, u);
if (!upiOk) fail++;
const upiT = QR_TYPES.find((t) => t.id === "upi")!;
for (const bad of [{ vpa: "nope" }, { vpa: "a@b", amount: "-5" }, { vpa: "shop@okaxis", amount: "12.345" }, { vpa: "shop@okaxis", amount: "600000" }]) {
  const v = validateContent(upiT, { ...samples.upi, name: "X", ...bad });
  if (v.ok) { fail++; console.log("FAIL  upi accepted invalid", bad); } else console.log("PASS  upi rejects", JSON.stringify(bad), "->", Object.values(v.errors)[0]);
}

console.log(fail ? `\n${fail} FAILURE(S)` : "\nAll QR checks passed");
process.exit(fail ? 1 : 0);
