import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive, ArrowRight, BarChart3, Barcode, BellRing, CalendarClock, FileSpreadsheet, Fingerprint, Globe, History, IndianRupee, KeyRound, Layers, Link2, LockKeyhole,
  Package, Palette, Printer, QrCode, RefreshCw, ScanLine, ShieldCheck, Tags, Upload,
} from "lucide-react";
import { CtaBand, Showcase } from "@/components/marketing";
import { TypeGlyph } from "@/components/brand-icon";
import { QR_TYPES } from "@/lib/qr-types";
import { BARCODE_MAP, renderBarcodeSvg } from "@/lib/barcodes";
import { mergeDesign, renderQr } from "@/lib/qr-render";
import { TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Features",
  description: "QR codes, UPI payment QR, dynamic codes with analytics, barcodes, a universal scanner, products and inventory, and bulk generation.",
};

const JUMP = [["create", "Create"], ["barcodes", "Barcodes"], ["manage", "Manage"], ["shop", "Run the shop"], ["trust", "Privacy & security"]];
const CLOUD = ["url", "upi", "whatsapp", "wifi", "instagram", "vcard", "menu", "maps", "youtube", "event", "spotify", "telegram"];

export default function FeaturesPage() {
  const qr = (id: string, prefix: string, extra: object = {}) =>
    renderQr("https://example.com", mergeDesign({ ...TEMPLATES.find((t) => t.id === id)!.design, margin: 1, ...extra }), { idPrefix: prefix }).svg;
  const styles = ["classic", "aurora", "ocean", "forest", "follow", "midnight"].map((id) => ({ id, svg: qr(id, `ft-${id}`, { frame: "none" }) }));
  const bc = (id: string, value: string, o = {}) => renderBarcodeSvg(id, value, { scale: 2, margin: 3, heightMm: 12, ...o });
  const barcodes = [
    { id: "ean13", svg: bc("ean13", "5901234123457") },
    { id: "code128", svg: bc("code128", "SKU-00428") },
    { id: "datamatrix", svg: bc("datamatrix", "QRS-LOT-2026") },
    { id: "pdf417", svg: bc("pdf417", "QRSathi sample label") },
  ];
  const dyn = qr("scan-me", "ft-dyn");

  return (
    <>
      {/* Intro */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden style={{ background: "radial-gradient(45% 60% at 85% 20%, hsl(var(--brand) / .10), transparent 70%)" }} />
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 lg:pt-24">
          <p className="text-sm font-medium text-brand">Features</p>
          <h1 className="mt-3 max-w-3xl animate-page-in font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl">Make it, print it, keep it working.</h1>
          <p className="mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">Everything below is available in the app today.</p>
          <nav aria-label="Feature sections" className="mt-8 flex flex-wrap gap-2">
            {JUMP.map(([id, l]) => (
              <a key={id} href={`#${id}`} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm text-zinc-700 transition hover:-translate-y-0.5 hover:shadow-card dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">{l}</a>
            ))}
          </nav>
        </div>
      </header>

      <Showcase id="create" eyebrow="Create" title="Codes that look like your brand — and still scan."
        lede="Every design is test-decoded in your browser before you download it."
        cta={["/generator", "Open the generator"]}
        items={[
          { icon: QrCode, title: `${QR_TYPES.length} content types`, text: "Links, Wi-Fi, contacts, events, social profiles, menus and more.", href: "/generator" },
          { icon: IndianRupee, title: "UPI payment QR", text: "Standard upi://pay codes and A4/A5 counter standees.", href: "/upi" },
          { icon: Palette, title: "Design studio", text: "Colours, gradients, shapes, logos, frames and captions.", href: "/studio" },
          { icon: Printer, title: "Print-ready exports", text: "PNG/JPG to 4096 px, SVG, 300 DPI PDF and posters." },
        ]}
        visual={
          <div className="stage relative rounded-[2rem] p-6 sm:p-8">
            <div className="grid grid-cols-3 gap-3">
              {styles.map((s, i) => (
                <div key={s.id} className="rounded-2xl bg-white p-2.5 shadow-pop ring-1 ring-black/5 transition duration-300 hover:-translate-y-1" style={{ transform: `rotate(${[-3, 2, -1, 1, -2, 3][i]}deg)` }}>
                  <div className="[&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`Example QR style ${i + 1}`} dangerouslySetInnerHTML={{ __html: s.svg }} />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-1.5" aria-hidden>
              {CLOUD.map((id) => { const t = QR_TYPES.find((x) => x.id === id)!; return <TypeGlyph key={id} brand={t.brand} icon={t.icon} size="sm" />; })}
            </div>
          </div>
        } />

      <div className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <Showcase id="barcodes" flip eyebrow="Barcodes" title="Retail, logistics and 2D — validated as you type."
          cta={["/barcodes", "Make a barcode"]}
          items={[
            { icon: Barcode, title: `${Object.keys(BARCODE_MAP).length} symbologies`, text: "EAN, UPC, ISBN, Code 128, GS1-128, ITF-14, Data Matrix, PDF417…", href: "/barcodes" },
            { icon: Tags, title: "Check digits & GS1 rules", text: "Wrong digits are caught before you print." },
            { icon: Printer, title: "Labels & sheets", text: "Name, price and SKU on printable label layouts." },
            { icon: FileSpreadsheet, title: "Bulk", text: "Hundreds of codes from one spreadsheet.", href: "/bulk" },
          ]}
          visual={
            <div className="relative mx-auto max-w-md rounded-[2rem] bg-zinc-100 p-6 dark:bg-zinc-900">
              <div className="grid grid-cols-2 gap-3">
                {barcodes.map((b) => (
                  <figure key={b.id} className="flex flex-col items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                    <div className={`grid h-24 place-items-center ${BARCODE_MAP[b.id].dims === "2d" && b.id !== "pdf417" ? "w-20" : "w-full"} [&>svg]:h-auto [&>svg]:max-h-24 [&>svg]:w-full`} role="img" aria-label={`${BARCODE_MAP[b.id].label} example`} dangerouslySetInnerHTML={{ __html: b.svg }} />
                    <figcaption className="mt-2 text-[11px] font-medium text-zinc-500">{BARCODE_MAP[b.id].label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          } />
      </div>

      <Showcase id="manage" eyebrow="Manage" title="Change where it points. Never reprint."
        lede="Dynamic codes encode a short link you control."
        cta={["/dynamic", "Create a dynamic QR"]}
        items={[
          { icon: RefreshCw, title: "Dynamic QR", text: "Re-point, pause or retire a printed code.", href: "/dynamic" },
          { icon: Layers, title: "Hosted pages", text: "Menus, link-in-bio, business profiles, coupons, feedback." },
          { icon: BarChart3, title: "Scan analytics", text: "Scans over time, devices and countries.", href: "/analytics" },
          { icon: CalendarClock, title: "Expiry & aliases", text: "End dates and memorable short links, by plan." },
          { icon: Link2, title: "Campaign tags", text: "UTM parameters added to the destination." },
          { icon: Archive, title: "Library", text: "Search, favourites, duplicates and download history.", href: "/codes" },
        ]}
        visual={
          <div className="stage relative mx-auto max-w-md rounded-[2rem] p-8" aria-hidden>
            <div className="mx-auto w-44 rounded-[1.5rem] bg-white p-3 shadow-pop ring-1 ring-black/5 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: dyn }} />
            <div className="mt-6 space-y-2">
              <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm opacity-60 ring-1 ring-black/5 dark:bg-zinc-900/80 dark:ring-white/10">
                <span className="h-2 w-2 rounded-full bg-zinc-400" /><span className="font-mono text-xs text-zinc-500 line-through">yourshop.in/summer-menu</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-card ring-1 ring-brand/30 dark:bg-zinc-900">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="font-mono text-xs">yourshop.in/winter-menu</span>
                <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Live</span>
              </div>
            </div>
            <p className="mt-4 text-center text-[11px] text-zinc-500">Illustration — same printed code, new destination</p>
          </div>
        } />

      <div className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <Showcase id="shop" flip eyebrow="Run the shop" title="Products, barcodes and stock in one place."
          cta={["/products", "Open products"]}
          items={[
            { icon: Package, title: "Products", text: "SKU, price, batch and expiry; up to ten barcodes each.", href: "/products" },
            { icon: History, title: "Stock movements", text: "In, out and stock-takes, with the balance after each.", href: "/inventory" },
            { icon: BellRing, title: "Low-stock levels", text: "Per-product thresholds flag what to reorder." },
            { icon: ScanLine, title: "Scan to find", text: "Look up your own products by barcode.", href: "/scanner" },
            { icon: Upload, title: "Import & export", text: "CSV or Excel, with per-row error reports." },
            { icon: Tags, title: "Internal GTINs", text: "In-store numbers in the GS1 restricted range. Retail GTINs come from GS1." },
          ]}
          visual={
            <figure className="mx-auto max-w-sm">
              <div className="rotate-[-2deg] rounded-2xl bg-white p-6 text-zinc-900 shadow-pop ring-1 ring-black/5 transition-transform duration-300 hover:rotate-0">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="font-serif text-xl">Masala Chai 250 g</p><p className="mt-0.5 text-xs text-zinc-500">SKU TEA-250 · Batch B12</p></div>
                  <p className="font-serif text-2xl">₹180</p>
                </div>
                <div className="mt-5 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: bc("ean13", "2001234567893", { heightMm: 16 }) }} />
              </div>
              <figcaption className="mt-4 text-center text-xs text-zinc-500">Example label with an internal (restricted-range) barcode</figcaption>
            </figure>
          } />
      </div>

      {/* Trust */}
      <section id="trust" className="scroll-mt-24 bg-zinc-950 text-white" aria-labelledby="trust-h">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <h2 id="trust-h" className="max-w-xl font-serif text-4xl leading-[1.08] tracking-[-0.02em]">Privacy & security, by default.</h2>
          <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: Fingerprint, title: "No raw IPs", text: "Salted daily hash for unique visitors; DNT and GPC honoured." },
              { icon: ShieldCheck, title: "Scam warnings", text: "Suspicious links and UPI requests are flagged before opening." },
              { icon: LockKeyhole, title: "Account security", text: "Hashed passwords, server sessions, rate-limited sign-in." },
              { icon: KeyRound, title: "Razorpay payments", text: "Card and UPI details never touch this site." },
              { icon: Globe, title: "Static = offline", text: "Static codes keep working without this service." },
            ].map((t) => (
              <li key={t.title}>
                <t.icon className="h-5 w-5 text-white/60" aria-hidden />
                <h3 className="mt-3 font-semibold">{t.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{t.text}</p>
              </li>
            ))}
          </ul>
          <Link href="/help" className="mt-12 inline-flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white">How we handle data <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
        </div>
      </section>

      <CtaBand title="Start with a free account — upgrade only if you need more." primary={["/signup", "Create a free account"]} secondary={["/pricing", "See pricing"]} />
    </>
  );
}
