import Link from "next/link";
import {
  ArrowRight, Boxes, Download, FileSpreadsheet, IndianRupee, LineChart, Palette, RefreshCw, ScanLine, ShieldCheck, Sparkles, MousePointerClick,
} from "lucide-react";
import { QR_TYPES, getType } from "@/lib/qr-types";
import { HeroQr } from "@/components/home/hero-qr";
import { QuickGenerator } from "@/components/home/quick-generator";
import { TypeGlyph } from "@/components/brand-icon";
import { getSettings } from "@/lib/settings";
import { safeJsonLd } from "@/lib/utils";
import { mergeDesign, renderQr } from "@/lib/qr-render";
import { renderBarcodeSvg } from "@/lib/barcodes";
import { TEMPLATES } from "@/lib/templates";
import { publishedPlans } from "@/lib/plan-store";
import { formatMoney, intervalsOf, isPaid } from "@/lib/plans";

export const dynamic = "force-dynamic";

const SOCIAL = QR_TYPES.filter((t) => t.category === "social" && t.brand);
const USE_CASES = ["upi", "menu", "wifi", "vcard", "maps", "event", "feedback", "coupon", "app", "links", "product", "file"];
const GALLERY = ["classic", "scan-me", "aurora", "ocean", "follow", "festive"];

const FAQ: [string, string][] = [
  ["Is it free?", "Static QR codes and barcodes are free: no account, no watermark, no download limit. Dynamic codes, analytics and inventory need a free account; paid plans raise the limits."],
  ["Will every design scan?", "Not necessarily. Low contrast, large logos and busy styles make codes harder to read. Each design is test-decoded in your browser and you'll see a warning when our scanner can't read it — still test the printed code with a few phones."],
  ["What's the difference between static and dynamic?", "A static code stores its content inside the image and works forever without this service. A dynamic code stores a short link that you can re-point later and that records privacy-respecting scan counts."],
  ["Does a UPI QR take payments for me?", "No. It opens the customer's UPI app with your details filled in; they confirm and pay with their own PIN. A scan is never treated as a payment — check your bank or UPI app for receipts."],
  ["Which formats can I download?", "PNG, JPG, SVG and PDF for QR codes, plus printable posters and label sheets. Barcodes export as PNG, SVG and PDF labels."],
];

export default async function HomePage() {
  const [settings, plans] = await Promise.all([getSettings(), publishedPlans()]);
  const b = settings.branding;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "WebApplication", name: b.brandName, applicationCategory: "BusinessApplication",
    operatingSystem: "Any", description: b.metaDescription || b.shortDescription, offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };
  const sample = (id: string, prefix: string, extra: object = {}) =>
    renderQr("https://example.com", mergeDesign({ ...TEMPLATES.find((t) => t.id === id)!.design, margin: 1, ...extra }), { idPrefix: prefix }).svg;
  const barcode = renderBarcodeSvg("ean13", "5901234123457", { scale: 2, margin: 4, heightMm: 14 });
  const code128 = renderBarcodeSvg("code128", "QRS-00428", { scale: 2, margin: 4, heightMm: 10 });
  const gallery = GALLERY.map((id) => ({ id, name: TEMPLATES.find((t) => t.id === id)!.name, svg: sample(id, `gal-${id}`) }));
  const branded = sample("pay-here", "home-badge");
  const paidPlans = plans.filter(isPaid);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden
          style={{ background: "radial-gradient(45% 50% at 80% 30%, hsl(var(--brand) / .10), transparent 70%)" }} />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-24">
          <div className="animate-page-in">
            {b.shortDescription && (
              <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden /> {b.shortDescription}
              </p>
            )}
            <h1 className="mt-6 font-serif text-[2.9rem] leading-[1.02] tracking-[-0.03em] sm:text-[4.2rem]">
              QR codes people <em className="italic text-brand">want</em> to scan.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">{b.homeDescription}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/generator" className="inline-flex h-12 items-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-lg active:scale-[0.98] dark:bg-white dark:text-zinc-950">
                Create QR Code <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/features" className="inline-flex h-12 items-center gap-2 rounded-full border border-zinc-300 px-6 text-sm font-medium transition hover:bg-white active:scale-[0.98] dark:border-zinc-700 dark:hover:bg-zinc-900">
                Explore Features
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2" aria-hidden>
                {SOCIAL.slice(0, 5).map((t) => <TypeGlyph key={t.id} brand={t.brand} icon={t.icon} size="sm" className="rounded-full ring-2 ring-[#fbfbf9] dark:ring-[#0b0b0d]" />)}
              </div>
              <p className="text-sm text-zinc-500">{QR_TYPES.length} QR types · free static codes, no watermark</p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[460px] lg:mx-0 lg:justify-self-end">
            <HeroQr />
            {/* Small examples (decorative; they encode example.com or sample barcode data) */}
            <div className="pointer-events-none absolute -left-24 top-[52%] hidden w-36 -rotate-6 rounded-2xl bg-white p-3 shadow-pop ring-1 ring-black/5 animate-float xl:block" aria-hidden>
              <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: barcode }} />
              <p className="mt-1 text-center text-[10px] font-medium text-zinc-500">EAN-13</p>
            </div>
            <div className="pointer-events-none absolute -right-8 bottom-24 hidden w-28 rotate-6 rounded-2xl bg-white p-2.5 shadow-pop ring-1 ring-black/5 xl:block" aria-hidden>
              <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: branded }} />
            </div>
          </div>
        </div>
      </section>

      {/* Social QR strip */}
      <section className="border-y border-zinc-200/80 bg-white/60 dark:border-zinc-800/80 dark:bg-zinc-950/40" aria-labelledby="social">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
          <h2 id="social" className="shrink-0 text-sm font-medium text-zinc-500">Social QR codes for</h2>
          <ul className="flex flex-wrap justify-center gap-2 md:justify-end">
            {SOCIAL.map((t) => (
              <li key={t.id}>
                <Link href={`/generator?type=${t.id}`} title={`${t.label} QR code`} className="group flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3 text-xs font-medium transition hover:-translate-y-0.5 hover:shadow-card dark:border-zinc-800 dark:bg-zinc-900">
                  <TypeGlyph brand={t.brand} icon={t.icon} size="sm" className="h-7 w-7 rounded-full shadow-none ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5" />
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Bento: what you can do */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-labelledby="bento">
        <h2 id="bento" className="max-w-2xl font-serif text-4xl leading-[1.08] tracking-[-0.02em] sm:text-5xl">One studio for every code you print.</h2>
        <div className="mt-12 grid auto-rows-[minmax(220px,auto)] gap-4 md:grid-cols-6">
          {/* Styling */}
          <Link href="/studio" className="group relative overflow-hidden rounded-[1.75rem] bg-zinc-950 p-7 text-white md:col-span-4 md:row-span-2">
            <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden style={{ background: "radial-gradient(60% 70% at 90% 0%, hsl(var(--brand) / .6), transparent 60%)" }} />
            <div className="relative">
              <Palette className="h-5 w-5 text-white/70" aria-hidden />
              <h3 className="mt-4 font-serif text-3xl">Style it your way</h3>
              <p className="mt-2 max-w-sm text-sm text-white/65">Colours, gradients, shapes, logos and frames — test-scanned as you go.</p>
            </div>
            <div className="relative mt-8 grid grid-cols-3 gap-3 sm:grid-cols-6 md:mt-12">
              {gallery.map((g, i) => (
                <div key={g.id} className="rounded-2xl bg-white p-2 shadow-xl transition duration-300 group-hover:-translate-y-1" style={{ transitionDelay: `${i * 30}ms` }}>
                  <div className="[&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`${g.name} style example`} dangerouslySetInnerHTML={{ __html: g.svg }} />
                </div>
              ))}
            </div>
            <span className="relative mt-6 inline-flex items-center gap-1 text-sm font-medium">Open the studio <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
          </Link>

          {/* Dynamic */}
          <Link href="/dynamic" className="group flex flex-col justify-between rounded-[1.75rem] border border-zinc-200 bg-white p-7 transition hover:shadow-pop dark:border-zinc-800 dark:bg-zinc-900 md:col-span-2">
            <div className="flex items-center gap-2" aria-hidden>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-mono text-[11px] text-zinc-500 line-through dark:bg-zinc-800">/old-menu</span>
              <ArrowRight className="h-3.5 w-3.5 text-brand" />
              <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[11px] text-brand">/new-menu</span>
            </div>
            <div>
              <RefreshCw className="h-5 w-5 text-brand" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">Dynamic QR</h3>
              <p className="mt-1 text-sm text-zinc-500">Change the destination after printing.</p>
            </div>
          </Link>

          {/* Analytics */}
          <Link href="/analytics" className="group flex flex-col justify-between rounded-[1.75rem] border border-zinc-200 bg-white p-7 transition hover:shadow-pop dark:border-zinc-800 dark:bg-zinc-900 md:col-span-2">
            <LineChart className="h-8 w-8 text-brand" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold">Private analytics</h3>
              <p className="mt-1 text-sm text-zinc-500">Scans, devices and countries — never raw IP addresses.</p>
            </div>
          </Link>

          {/* Barcodes */}
          <Link href="/barcodes" className="group flex flex-col justify-between rounded-[1.75rem] border border-zinc-200 bg-white p-7 transition hover:shadow-pop dark:border-zinc-800 dark:bg-zinc-900 md:col-span-3">
            <div className="flex items-end gap-4" aria-hidden>
              <div className="w-40 rounded-xl bg-white p-2 ring-1 ring-zinc-100 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: barcode }} />
              <div className="hidden w-36 rounded-xl bg-white p-2 ring-1 ring-zinc-100 sm:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: code128 }} />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Barcodes, checked</h3>
              <p className="mt-1 text-sm text-zinc-500">EAN, UPC, Code 128, GS1, Data Matrix, PDF417 — with check digits.</p>
            </div>
          </Link>

          {/* Scanner */}
          <Link href="/scanner" className="group relative flex flex-col justify-between overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white p-7 transition hover:shadow-pop dark:border-zinc-800 dark:bg-zinc-900 md:col-span-3">
            <div className="relative mx-auto grid h-24 w-24 place-items-center" aria-hidden>
              {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "left-0 bottom-0 border-l-2 border-b-2", "right-0 bottom-0 border-r-2 border-b-2"].map((c) => (
                <span key={c} className={`absolute h-6 w-6 rounded-sm border-brand ${c}`} />
              ))}
              <ScanLine className="h-9 w-9 text-zinc-400" />
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Universal scanner</h3>
              <p className="mt-1 text-sm text-zinc-500">Camera or image, on your device. Flags suspicious links.</p>
            </div>
          </Link>

          {/* Inventory */}
          <Link href="/products" className="group flex items-center gap-6 rounded-[1.75rem] border border-zinc-200 bg-white p-7 transition hover:shadow-pop dark:border-zinc-800 dark:bg-zinc-900 md:col-span-3">
            <Boxes className="h-10 w-10 shrink-0 text-brand" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold">Products & stock</h3>
              <p className="mt-1 text-sm text-zinc-500">SKUs, barcodes, stock in and out, low-stock alerts and labels.</p>
            </div>
          </Link>

          {/* Bulk */}
          <Link href="/bulk" className="group flex items-center gap-6 rounded-[1.75rem] border border-zinc-200 bg-white p-7 transition hover:shadow-pop dark:border-zinc-800 dark:bg-zinc-900 md:col-span-3">
            <FileSpreadsheet className="h-10 w-10 shrink-0 text-brand" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold">Bulk from a spreadsheet</h3>
              <p className="mt-1 text-sm text-zinc-500">CSV or Excel in, a ZIP or print sheet out.</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Use cases */}
      <section className="bg-white py-24 dark:bg-zinc-950" aria-labelledby="types">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h2 id="types" className="max-w-xl font-serif text-4xl leading-[1.08] tracking-[-0.02em]">A code for every counter, menu and shelf.</h2>
            <Link href="/generator" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">All {QR_TYPES.length} types <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </div>
          <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {USE_CASES.map((id) => {
              const t = getType(id);
              return (
                <li key={id}>
                  <Link href={`/generator?type=${id}`} className="group flex h-full flex-col gap-4 rounded-2xl border border-zinc-200/80 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-card dark:border-zinc-800 dark:hover:border-zinc-700">
                    <TypeGlyph brand={t.brand} icon={t.icon} className="transition-transform duration-200 group-hover:scale-105" />
                    <span>
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{t.description}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-labelledby="how">
        <h2 id="how" className="text-center font-serif text-4xl tracking-[-0.02em]">How it works</h2>
        <div className="relative mt-14">
        <div className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700 md:block" aria-hidden />
        <ol className="relative grid gap-10 md:grid-cols-3">
          {[
            { icon: MousePointerClick, title: "Pick a type", text: "Link, UPI, Wi-Fi, menu, social…" },
            { icon: Palette, title: "Make it yours", text: "Colours, logo, frame — checked live." },
            { icon: Download, title: "Download & print", text: "PNG, SVG, PDF or a ready poster." },
          ].map((s, i) => (
            <li key={s.title} className="relative text-center">
              <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-pop ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <s.icon className="h-6 w-6 text-brand" aria-hidden />
                <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-zinc-950 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-950">{i + 1}</span>
              </span>
              <h3 className="mt-5 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{s.text}</p>
            </li>
          ))}
        </ol>
        </div>
      </section>

      {/* Try it */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6" aria-labelledby="try">
        <h2 id="try" className="sr-only">Quick generator</h2>
        <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04),0_24px_48px_-24px_rgba(0,0,0,.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            <span className="text-xs font-medium text-zinc-500">Quick generator — the real tool, right here</span>
          </div>
          <QuickGenerator bare />
        </div>
      </section>

      {/* UPI */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="grid items-center gap-12 overflow-hidden rounded-[1.75rem] bg-[#fff7ed] p-8 text-zinc-900 dark:bg-[#1c130c] dark:text-zinc-100 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <IndianRupee className="h-6 w-6 text-orange-600" aria-hidden />
            <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.02em]">Accept UPI with a QR you design.</h2>
            <ul className="mt-6 space-y-2.5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>Works with every UPI app; fixed or open amount.</li>
              <li>Print an A4 or A5 counter standee.</li>
              <li>Customers pay with their own PIN — we never see money, PINs or OTPs.</li>
              <li>A scan is never treated as a payment. Check your bank or UPI app for receipts.</li>
            </ul>
            <Link href="/upi" className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition active:scale-[0.98] dark:bg-white dark:text-zinc-950">Make a UPI QR <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <figure className="mx-auto w-full max-w-[260px] rotate-2 transition-transform duration-300 hover:rotate-0">
            <div className="overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-pop">
              <div className="bg-[#c2410c] px-6 py-4 text-center text-white"><p className="text-lg font-semibold tracking-wide">SCAN &amp; PAY</p><p className="text-xs text-white/85">Pay with any UPI app</p></div>
              <div className="p-6 text-center">
                <p className="font-medium">Your shop name</p>
                <div className="mx-auto mt-4 w-40 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: sample("pay-here", "home-upi", { frame: "none" }) }} />
                <p className="mt-4 font-mono text-xs text-zinc-500">UPI ID: yourshop@upi</p>
              </div>
            </div>
            <figcaption className="mt-3 text-center text-xs text-zinc-500">Example standee — this code is not a payment QR.</figcaption>
          </figure>
        </div>
      </section>

      {/* Pricing preview (real plans) */}
      {plans.length > 0 && (
        <section className="border-t border-zinc-200 dark:border-zinc-800" aria-labelledby="pricing">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <h2 id="pricing" className="font-serif text-4xl tracking-[-0.02em]">Simple pricing</h2>
              <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Compare plans <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {plans.slice(0, 3).map((p, i) => {
                const iv = intervalsOf(p)[0];
                const featured = plans.length > 1 && i === 1;
                return (
                  <Link key={p.id} href="/pricing" className={`group rounded-[1.5rem] p-7 transition hover:-translate-y-0.5 ${featured ? "bg-zinc-950 text-white shadow-pop dark:bg-white dark:text-zinc-950" : "border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}`}>
                    <p className="text-sm font-medium opacity-80">{p.name}</p>
                    <p className="mt-4 font-serif text-4xl tabular-nums">{isPaid(p) ? formatMoney(iv === "year" ? p.annualPrice : p.monthlyPrice, p.currency) : formatMoney(0, p.currency)}
                      <span className="ml-1 font-sans text-sm opacity-60">{isPaid(p) ? (iv === "year" ? "/ year" : "/ month") : "forever"}</span></p>
                    <p className="mt-3 text-sm opacity-70">{p.description}</p>
                  </Link>
                );
              })}
            </div>
            {paidPlans.length > 0 && <p className="mt-4 text-sm text-zinc-500">Paid plans renew through Razorpay until you cancel.</p>}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" aria-labelledby="faq">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 md:grid-cols-[1fr_2fr]">
          <div>
            <h2 id="faq" className="font-serif text-4xl tracking-[-0.02em]">Questions</h2>
            <p className="mt-3 flex items-center gap-2 text-sm text-zinc-500"><ShieldCheck className="h-4 w-4 text-brand" aria-hidden /> Straight answers, no fine print.</p>
            <Link href="/help" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Help centre <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </div>
          <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-500 transition-transform duration-200 group-open:rotate-45 dark:border-zinc-700" aria-hidden>+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 px-6 py-16 text-center text-white sm:px-12">
          <div className="pointer-events-none absolute inset-0" aria-hidden style={{ background: "radial-gradient(50% 80% at 50% 0%, hsl(var(--brand) / .55), transparent 70%)" }} />
          <h2 className="relative mx-auto max-w-2xl font-serif text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">Make your first code in under a minute.</h2>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/generator" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 transition hover:-translate-y-px active:scale-[0.98]">Create QR Code <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link href="/signup" className="inline-flex h-12 items-center rounded-full px-6 text-sm font-medium ring-1 ring-inset ring-white/25 transition hover:bg-white/10">Create a free account</Link>
          </div>
        </div>
      </section>
    </>
  );
}
