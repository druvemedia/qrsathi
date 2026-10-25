/**
 * API integration tests against a running server.
 *   BASE_URL=http://localhost:3100 npm run test:api
 * Creates two throwaway users, exercises products/inventory/auth and existing
 * QR/UPI features, then deletes both accounts.
 */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const IP = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
let pass = 0, fail = 0;
const check = (name: string, cond: boolean, info: unknown = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond ? `  → ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
};

async function call(method: string, path: string, body?: unknown, cookie?: string, extra: Record<string, string> = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: { Origin: BASE, "X-Forwarded-For": IP, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function signup(tag: string) {
  const email = `test-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const r = await call("POST", "/api/auth/signup", { name: `Test ${tag}`, email, password: "testpass123", acceptTerms: true });
  const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  return { email, cookie, status: r.status };
}

console.log(`Testing ${BASE}\n`);

// ---------- authentication required ----------
console.log("# Authentication & CSRF");
for (const [m, p] of [["GET", "/api/products"], ["POST", "/api/products"], ["GET", "/api/products/lookup?code=1"], ["GET", "/api/inventory"], ["GET", "/api/overview"], ["POST", "/api/products/import"]] as const) {
  const r = await call(m, p, m === "POST" ? {} : undefined);
  check(`${m} ${p} requires sign-in (401)`, r.status === 401, r.status);
}
const csrf = await fetch(BASE + "/api/products", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" });
check("cross-site POST blocked (403)", csrf.status === 403, csrf.status);

const A = await signup("a");
const B = await signup("b");
check("sign-up user A", A.status === 201 && !!A.cookie, A.status);
check("sign-up user B", B.status === 201 && !!B.cookie, B.status);

try {
  // ---------- product creation ----------
  console.log("\n# Products");
  const code = await call("GET", "/api/products/next-code?format=ean13", undefined, A.cookie);
  check("internal EAN-13 is generated in restricted range (starts with 2)", code.status === 200 && /^2\d{12}$/.test(code.data.value), code.data);
  const p1 = await call("POST", "/api/products", {
    name: "Masala Chai 250g", sku: "TEST-CHAI-250", brand: "Sathi", category: "Beverages", variant: "250 g", price: "199.50", currency: "INR",
    stock: "10", lowStockAt: "3", batch: "L42", expiryDate: "2027-03-31",
    barcodes: [{ format: "ean13", value: code.data.value, source: "internal", isPrimary: true }, { format: "code128", value: "TEST-CHAI-250", source: "internal" }],
  }, A.cookie);
  check("create product (201)", p1.status === 201, p1.data);
  const P1 = p1.data.item;
  check("price stored in paise", P1?.priceMinor === 19950, P1?.priceMinor);
  check("two barcodes saved, EAN-13 primary", P1?.barcodes?.length === 2 && P1.barcodes[0].format === "ean13" && P1.barcodes[0].isPrimary, P1?.barcodes);

  const dupSku = await call("POST", "/api/products", { name: "Other", sku: "TEST-CHAI-250" }, A.cookie);
  check("duplicate SKU rejected (409)", dupSku.status === 409, dupSku.data);
  const dupCode = await call("POST", "/api/products", { name: "Other", sku: "TEST-OTHER-1", barcodes: [{ format: "ean13", value: code.data.value, source: "internal" }] }, A.cookie);
  check("duplicate barcode rejected (409)", dupCode.status === 409, dupCode.data);
  const p2 = await call("POST", "/api/products", { name: "Imported Soda", sku: "TEST-SODA", stock: 4, barcodes: [{ format: "upca", value: "036000291452", source: "existing" }] }, A.cookie);
  check("create product with existing UPC-A", p2.status === 201, p2.data);
  const dupEquiv = await call("POST", "/api/products", { name: "Clash", sku: "TEST-CLASH", barcodes: [{ format: "ean13", value: "0036000291452", source: "existing" }] }, A.cookie);
  check("EAN-13 equivalent of an existing UPC-A rejected as duplicate (409)", dupEquiv.status === 409, dupEquiv.data);
  const badCheck = await call("POST", "/api/products", { name: "Bad", sku: "TEST-BAD", barcodes: [{ format: "ean13", value: "5901234123458", source: "existing" }] }, A.cookie);
  check("wrong EAN-13 check digit rejected (400)", badCheck.status === 400 && /check digit/i.test(badCheck.data.error), badCheck.data);
  const fakeGtin = await call("POST", "/api/products", { name: "Bad", sku: "TEST-BAD2", barcodes: [{ format: "ean13", value: "5901234123457", source: "internal" }] }, A.cookie);
  check("'internal' barcode outside restricted range rejected (400)", fakeGtin.status === 400 && /restricted/i.test(fakeGtin.data.error), fakeGtin.data);
  const badField = await call("POST", "/api/products", { name: "", sku: "x" }, A.cookie);
  check("missing name rejected (400)", badField.status === 400, badField.data);
  const badPrice = await call("POST", "/api/products", { name: "P", sku: "TEST-P", price: "12.345" }, A.cookie);
  check("invalid price rejected (400)", badPrice.status === 400, badPrice.data);

  // ---------- lookup ----------
  console.log("\n# Barcode lookup");
  const l1 = await call("GET", `/api/products/lookup?code=${code.data.value}&format=EAN13`, undefined, A.cookie);
  check("lookup by EAN-13 finds product", l1.data.found && l1.data.item.id === P1.id, l1.data);
  const l2 = await call("GET", "/api/products/lookup?code=0036000291452&format=EAN13", undefined, A.cookie);
  check("scanned EAN-13 form finds UPC-A product", l2.data.found && l2.data.item.sku === "TEST-SODA", l2.data);
  const l3 = await call("GET", "/api/products/lookup?code=TEST-CHAI-250", undefined, A.cookie);
  check("lookup by Code 128 / SKU finds product", l3.data.found && l3.data.item.id === P1.id, l3.data);
  const l4 = await call("GET", "/api/products/lookup?code=9999999999994", undefined, A.cookie);
  check("unknown barcode → found:false", l4.status === 200 && l4.data.found === false, l4.data);
  const after = await call("GET", `/api/products/${P1.id}`, undefined, A.cookie);
  check("lookups did not change stock", after.data.item.stock === 10, after.data.item.stock);

  // ---------- stock ----------
  console.log("\n# Stock in / out / adjust");
  const sIn = await call("POST", `/api/products/${P1.id}/stock`, { type: "in", quantity: 5, reference: "PO-1" }, A.cookie);
  check("stock in +5 → 15", sIn.data.item?.stock === 15, sIn.data);
  const sOut = await call("POST", `/api/products/${P1.id}/stock`, { type: "out", quantity: 3, note: "sale" }, A.cookie);
  check("stock out −3 → 12", sOut.data.item?.stock === 12, sOut.data);
  const sOver = await call("POST", `/api/products/${P1.id}/stock`, { type: "out", quantity: 100 }, A.cookie);
  check("stock out beyond available rejected (400)", sOver.status === 400 && /not enough/i.test(sOver.data.error), sOver.data);
  const sZero = await call("POST", `/api/products/${P1.id}/stock`, { type: "in", quantity: 0 }, A.cookie);
  check("zero quantity rejected (400)", sZero.status === 400, sZero.data);
  const sAdj = await call("POST", `/api/products/${P1.id}/stock`, { type: "adjust", quantity: 2 }, A.cookie);
  check("adjust (stock-take) sets 2, low-stock flagged", sAdj.data.item?.stock === 2 && sAdj.data.item?.lowStock === true, sAdj.data);
  const hist = await call("GET", `/api/products/${P1.id}/history`, undefined, A.cookie);
  const types = hist.data.items.map((t: any) => `${t.type}:${t.quantity}:${t.balance}`).reverse();
  check("activity history records every movement with balances", JSON.stringify(types) === JSON.stringify(["created:10:10", "in:5:15", "out:-3:12", "adjust:-10:2"]), types);

  // ---------- authorization ----------
  console.log("\n# Authorization between users");
  check("user B cannot read A's product (404)", (await call("GET", `/api/products/${P1.id}`, undefined, B.cookie)).status === 404);
  check("user B cannot edit A's product (404)", (await call("PATCH", `/api/products/${P1.id}`, { name: "hacked" }, B.cookie)).status === 404);
  check("user B cannot move A's stock (404)", (await call("POST", `/api/products/${P1.id}/stock`, { type: "out", quantity: 1 }, B.cookie)).status === 404);
  check("user B's lookup doesn't see A's barcode", (await call("GET", `/api/products/lookup?code=${code.data.value}`, undefined, B.cookie)).data.found === false);
  check("user B's product list is empty", (await call("GET", "/api/products", undefined, B.cookie)).data.items.length === 0);
  const bSame = await call("POST", "/api/products", { name: "Same SKU other user", sku: "TEST-CHAI-250", barcodes: [{ format: "upca", value: "036000291452", source: "existing" }] }, B.cookie);
  check("same SKU/barcode allowed for a different user", bSame.status === 201, bSame.data);
  check("normal user can't access admin API (403)", (await call("GET", "/api/admin/stats", undefined, A.cookie)).status === 403);

  // ---------- edit / archive ----------
  console.log("\n# Edit & archive");
  const ed = await call("PATCH", `/api/products/${P1.id}`, { price: "210", category: "Tea" }, A.cookie);
  check("edit price & category", ed.data.item?.priceMinor === 21000 && ed.data.item?.category === "Tea", ed.data);
  check("partial edit keeps untouched fields and barcodes", ed.data.item?.brand === "Sathi" && ed.data.item?.batch === "L42" && ed.data.item?.expiryDate === "2027-03-31" && ed.data.item?.barcodes?.length === 2, ed.data.item);
  check("deleting an active product is refused (400)", (await call("DELETE", `/api/products/${p2.data.item.id}`, undefined, A.cookie)).status === 400);
  const ar = await call("PATCH", `/api/products/${P1.id}`, { status: "archived" }, A.cookie);
  check("archive product", ar.data.item?.status === "archived", ar.data);
  check("archived product: stock changes refused (400)", (await call("POST", `/api/products/${P1.id}/stock`, { type: "in", quantity: 1 }, A.cookie)).status === 400);
  check("archived product hidden from default list", !(await call("GET", "/api/products", undefined, A.cookie)).data.items.some((p: any) => p.id === P1.id));
  check("search by barcode value finds product (all statuses)", (await call("GET", `/api/products?status=all&q=${code.data.value}`, undefined, A.cookie)).data.items.some((p: any) => p.id === P1.id));
  check("delete archived product", (await call("DELETE", `/api/products/${P1.id}`, undefined, A.cookie)).status === 200);

  // ---------- import ----------
  console.log("\n# Import (CSV/XLSX rows)");
  const rows = [
    { name: "Basmati Rice 1kg", sku: "TEST-RICE-1", price: "120", stock: "50", category: "Grocery", barcode: "8901234567890", barcode_format: "ean13" },
    { name: "Duplicate in file", sku: "TEST-RICE-1", price: "1" },
    { name: "Bad barcode", sku: "TEST-BADCODE", barcode: "8901234567891", barcode_format: "ean13" },
    { name: "Soda again", sku: "TEST-SODA", stock: "9" },
    { name: "", sku: "TEST-NONAME" },
    { name: "Same barcode as row 2", sku: "TEST-RICE-2", barcode: "8901234567890" },
    { name: "Code 39 part", sku: "TEST-PART", barcode: "PART-77", barcode_format: "code39", barcode_source: "internal" },
  ];
  const imp = await call("POST", "/api/products/import", { mode: "skip", rows }, A.cookie);
  const st = imp.data.results?.map((r: any) => r.status);
  check("import report statuses", JSON.stringify(st) === JSON.stringify(["created", "error", "error", "skipped", "error", "error", "created"]), imp.data.results);
  check("import summary", imp.data.summary?.created === 2 && imp.data.summary?.errors === 4 && imp.data.summary?.skipped === 1, imp.data.summary);
  const upd = await call("POST", "/api/products/import", { mode: "update", rows: [{ name: "Imported Soda (renamed)", sku: "TEST-SODA", stock: "9" }] }, A.cookie);
  check("import update mode updates existing SKU", upd.data.summary?.updated === 1, upd.data);
  const soda = (await call("GET", "/api/products/lookup?code=TEST-SODA", undefined, A.cookie)).data.item;
  check("import update: name changed and stock set via logged adjustment", soda?.name === "Imported Soda (renamed)" && soda?.stock === 9, soda);
  const sodaHist = await call("GET", `/api/products/${soda.id}/history`, undefined, A.cookie);
  check("import stock change recorded as adjustment", sodaHist.data.items.some((t: any) => t.type === "adjust" && t.balance === 9 && t.reference === "import"), sodaHist.data.items);

  // ---------- inventory dashboard ----------
  const ov = await call("GET", "/api/overview", undefined, A.cookie);
  check("overview shows real counts (3 products, 59 units)", ov.status === 200 && ov.data.counts.products === 3 && ov.data.counts.units === 59 && Array.isArray(ov.data.activity), ov.data.counts);
  const inv = await call("GET", "/api/inventory", undefined, A.cookie);
  check("inventory summary totals", inv.status === 200 && inv.data.totals.products === 3 && inv.data.totals.units === 50 + 9, inv.data.totals);

  // ---------- existing features still work ----------
  console.log("\n# Existing QR / UPI / dynamic features");
  const upi = await call("POST", "/api/qrcodes", { name: "UPI", type: "upi", content: { vpa: "shop@okaxis", name: "Shop", amount: "99.5", note: "", mc: "", tr: "" }, design: {} }, A.cookie);
  check("UPI QR saved with correct URI", upi.data.item?.payload === "upi://pay?pa=shop@okaxis&pn=Shop&am=99.50&cu=INR", upi.data);
  const badUpi = await call("POST", "/api/qrcodes", { name: "x", type: "upi", content: { vpa: "nope", name: "S", amount: "", note: "", mc: "", tr: "" }, design: {} }, A.cookie);
  check("invalid UPI ID rejected", badUpi.status === 400, badUpi.data);
  const dyn = await call("POST", "/api/qrcodes", { name: "Dyn", type: "dynamic", content: { url: "example.com/x" }, design: {} }, A.cookie);
  check("dynamic QR created", dyn.status === 201 && /\/r\/\w+$/.test(dyn.data.item?.payload), dyn.data);
  const redirect = await fetch(`${BASE}/r/${dyn.data.item.shortCode}`, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (iPhone) Safari" } });
  check("dynamic QR redirects (302)", redirect.status === 302 && redirect.headers.get("location") === "https://example.com/x", `${redirect.status} ${redirect.headers.get("location")}`);
  for (const page of ["/", "/generator", "/barcodes", "/generator?mode=barcode", "/scanner", "/upi", "/bulk?mode=barcode", "/scan-history", "/zxing/zxing_reader.wasm"]) {
    const r = await fetch(BASE + page);
    check(`GET ${page} → 200`, r.status === 200, r.status);
  }
  for (const page of ["/products", "/inventory", "/products/new"]) {
    const r = await fetch(BASE + page, { redirect: "manual" });
    check(`guest GET ${page} redirects to login`, r.status === 307 && /\/login/.test(r.headers.get("location") || ""), `${r.status} ${r.headers.get("location")}`);
    const r2 = await fetch(BASE + page, { headers: { Cookie: A.cookie } });
    check(`signed-in GET ${page} → 200`, r2.status === 200, r2.status);
  }
} finally {
  // ---------- cleanup ----------
  for (const u of [A, B]) if (u.cookie) await call("DELETE", "/api/account", { confirm: u.email }, u.cookie);
  console.log("\n(test users deleted)");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
