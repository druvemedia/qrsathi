import Link from "next/link";
import { ArrowRight, Barcode, FileSpreadsheet, IndianRupee, LineChart, Package, Palette, QrCode, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import { QR_TYPES } from "@/lib/qr-types";
import { QuickGenerator } from "@/components/home/quick-generator";
import { getSettings } from "@/lib/settings";
import { safeJsonLd } from "@/lib/utils";
import { renderQr } from "@/lib/qr-render";
import { renderBarcodeSvg } from "@/lib/barcodes";
import { TEMPLATES } from "@/lib/templates";
import { publishedPlans } from "@/lib/plan-store";
import { formatMoney, intervalsOf, isPaid } from "@/lib/plans";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: IndianRupee, title: "UPI payment QR", text: "Standards-compatible upi://pay codes for any UPI app, with a fixed or open amount and a printable counter standee.", href: "/upi" },
  { icon: RefreshCw, title: "Dynamic QR codes", text: "Change where a printed code points, pause it, set an expiry date or add campaign tags — without reprinting.", href: "/dynamic" },
  { icon: LineChart, title: "Privacy-first analytics", text: "Daily scans, devices and countries for your dynamic codes. Raw IP addresses are never stored.", href: "/analytics" },
  { icon: Package, title: "Products & inventory", text: "Products with SKUs and barcodes, stock in and out, low-stock levels and an activity history for every change.", href: "/products" },
  { icon: FileSpreadsheet, title: "Bulk generation", text: "Upload a CSV or Excel sheet, map the columns, check every row and download a ZIP or a print-ready sheet.", href: "/bulk" },
  { icon: Palette, title: "Design studio", text: "Colours, module shapes, logos and frames. Every design is decoded in the browser before you download it.", href: "/studio" },
];

export default async function HomePage() {
  const [settings, plans] = await Promise.all([getSettings(), publishedPlans()]);
  const b = settings.branding;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "WebApplication", name: b.brandName, applicationCategory: "BusinessApplication",
    operatingSystem: "Any", description: b.metaDescription || b.shortDescription, offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };
  const qrSample = renderQr("https://example.com/menu", { ...TEMPLATES.find((t) => t.id === "classic")!.design, margin: 1 }, { idPrefix: "home-qr" }).svg;
  const barcodeSample = renderBarcodeSvg("code128", "QRS-00428", { scale: 2, margin: 4, heightMm: 12 });
  const standee = renderQr("Example only — make your own UPI QR at /upi", { ...TEMPLATES.find((t) => t.id === "pay-here")!.design, frame: "none", margin: 1 }, { idPrefix: "home-upi" }).svg;
  const paidPlans = plans.filter(isPaid);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-16 sm:px-6 lg:pt-24">
        <div className="max-w-3xl">
          {b.shortDescription && <p className="text-sm font-medium text-brand">{b.shortDescription}</p>}
          <h1 className="mt-4 font-serif text-[2.6rem] leading-[1.05] tracking-tight sm:text-6xl">
            QR codes and barcodes that keep working <em className="italic text-zinc-500 dark:text-zinc-400">after</em> you print them.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">{b.homeDescription}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/generator" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-brand-fg shadow-sm transition-[transform,background-color] hover:bg-brand/90 active:scale-[0.98]">Create a QR code <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link href="/scanner" className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-300 px-5 text-sm font-medium transition-colors hover:bg-white active:scale-[0.98] dark:border-zinc-700 dark:hover:bg-zinc-900">Open the scanner</Link>
          </div>
          <p className="mt-4 text-sm text-zinc-500">Static codes are free with no account, no watermark and no download limit.</p>
        </div>

        <div className="mt-14 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04),0_24px_48px_-24px_rgba(0,0,0,.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
            <span className="flex gap-1.5" aria-hidden><span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" /><span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" /><span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" /></span>
            <span className="ml-2 text-xs text-zinc-500">Quick generator — this is the real tool, try it</span>
          </div>
          <QuickGenerator bare />
        </div>
      </section>

      {/* Tools */}
      <section className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" aria-labelledby="tools">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h2 id="tools" className="max-w-xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">Three tools, one place to keep what you make.</h2>
            <Link href="/tools" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">All tools <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 md:grid-cols-3">
            <Link href="/generator" className="group flex flex-col bg-white p-7 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
              <div className="flex h-40 items-center justify-center rounded-lg bg-zinc-50 dark:bg-white"><div className="h-28 w-28 [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="Sample QR code" dangerouslySetInnerHTML={{ __html: qrSample }} /></div>
              <h3 className="mt-6 flex items-center gap-2 font-medium"><QrCode className="h-4 w-4 text-brand" aria-hidden /> QR code generator</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{QR_TYPES.length} content types — links, UPI, Wi-Fi, WhatsApp, contact cards, menus and more — exported as PNG, JPG, SVG or PDF.</p>
            </Link>
            <Link href="/barcodes" className="group flex flex-col bg-white p-7 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
              <div className="flex h-40 items-center justify-center rounded-lg bg-zinc-50 dark:bg-white"><div className="w-48 [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label="Sample Code 128 barcode" dangerouslySetInnerHTML={{ __html: barcodeSample }} /></div>
              <h3 className="mt-6 flex items-center gap-2 font-medium"><Barcode className="h-4 w-4 text-brand" aria-hidden /> Barcode generator</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">EAN-13, UPC, Code 128, GS1-128, ITF-14, Data Matrix, PDF417 and more, with check-digit validation and printable labels.</p>
            </Link>
            <Link href="/scanner" className="group flex flex-col bg-white p-7 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900">
              <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                <ScanLine className="h-10 w-10 text-zinc-400" aria-hidden />
                <p className="font-mono text-[11px] text-zinc-500">QR · EAN · UPC · Code 128 · Data Matrix · PDF417</p>
              </div>
              <h3 className="mt-6 flex items-center gap-2 font-medium"><ScanLine className="h-4 w-4 text-brand" aria-hidden /> Universal scanner</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">Scan with the camera or from an image, on the device. Warns about suspicious links and finds your own products by barcode.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="features">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 id="features" className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">Built for the counter, the shelf and the campaign.</h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Everything below is available in the app today.</p>
            <Link href="/features" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">See all features <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </div>
          <ol className="grid gap-x-10 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="border-t border-zinc-200 py-6 dark:border-zinc-800">
                <Link href={f.href} className="group block">
                  <span className="font-mono text-xs text-zinc-400">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 flex items-center gap-2 font-medium"><f.icon className="h-4 w-4 text-brand" aria-hidden /> {f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.text}</p>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* UPI */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid items-center gap-12 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 sm:p-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-brand">UPI</p>
            <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight">Accept UPI with a QR you design.</h2>
            <ul className="mt-6 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Enter your UPI ID and name; the code works with every UPI app.</li>
              <li>Print an A4 or A5 standee with your shop name and UPI ID.</li>
              <li>Customers confirm the payee and pay with their own PIN. We never see money, PINs or OTPs.</li>
              <li>A scan is never treated as a payment — check your bank or UPI app for receipts.</li>
            </ul>
            <Link href="/upi" className="mt-8 inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white transition-transform active:scale-[0.98] dark:bg-white dark:text-zinc-950">Make a UPI QR <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <figure className="mx-auto w-full max-w-xs">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm">
              <div className="bg-[#c2410c] px-6 py-5 text-center text-white"><p className="text-lg font-semibold tracking-wide">SCAN &amp; PAY</p><p className="text-xs text-white/85">Pay with any UPI app</p></div>
              <div className="p-6 text-center">
                <p className="font-medium">Sharma General Store</p>
                <div className="mx-auto mt-4 w-44 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: standee }} />
                <p className="mt-4 font-mono text-xs text-zinc-500">UPI ID: yourshop@upi</p>
              </div>
            </div>
            <figcaption className="mt-3 text-center text-xs text-zinc-500">Example standee. This code is not a payment QR.</figcaption>
          </figure>
        </div>
      </section>

      {/* Pricing teaser (real plans) */}
      {plans.length > 0 && (
        <section className="border-t border-zinc-200 dark:border-zinc-800" aria-labelledby="pricing">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <h2 id="pricing" className="font-serif text-3xl tracking-tight sm:text-4xl">Pricing</h2>
              <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Compare plans <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 md:grid-cols-3">
              {plans.slice(0, 3).map((p) => {
                const i = intervalsOf(p)[0];
                return (
                  <div key={p.id} className="bg-white p-6 dark:bg-zinc-950">
                    <p className="font-medium">{p.name}</p>
                    <p className="mt-3 text-2xl font-semibold tabular-nums">{isPaid(p) ? formatMoney(i === "year" ? p.annualPrice : p.monthlyPrice, p.currency) : formatMoney(0, p.currency)}<span className="ml-1 text-sm font-normal text-zinc-500">{isPaid(p) ? (i === "year" ? "/ year" : "/ month") : "forever"}</span></p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{p.description}</p>
                  </div>
                );
              })}
            </div>
            {paidPlans.length > 0 && <p className="mt-4 text-sm text-zinc-500">Paid plans renew through Razorpay until you cancel.</p>}
          </div>
        </section>
      )}

      {/* Principles */}
      <section className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_2fr]">
          <h2 className="flex items-start gap-3 font-serif text-3xl leading-tight tracking-tight"><ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-brand" aria-hidden /> Honest by design.</h2>
          <dl className="grid gap-8 sm:grid-cols-2">
            {[
              ["No payment data", "UPI QR codes only request a payment. The app never asks for PINs, OTPs or bank passwords."],
              ["No raw IP addresses", "Scan analytics use a salted, daily-rotating hash. Do-Not-Track and GPC are honoured."],
              ["Codes you own", "Static codes contain their content and work without this service. Dynamic codes depend on it — we say so up front."],
              ["Checked before download", "Every design is decoded in your browser; you see “scan test passed” only when it reads back exactly."],
            ].map(([t, d]) => <div key={t}><dt className="font-medium">{t}</dt><dd className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{d}</dd></div>)}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
        <h2 className="mx-auto max-w-2xl font-serif text-4xl leading-tight tracking-tight">Make your first code in under a minute.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/generator" className="inline-flex h-11 items-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-fg transition-transform active:scale-[0.98]">Open the generator</Link>
          <Link href="/signup" className="inline-flex h-11 items-center rounded-lg border border-zinc-300 px-5 text-sm font-medium transition-colors hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900">Create a free account</Link>
        </div>
      </section>
    </>
  );
}
