import Link from "next/link";
import {
  ArrowRight, Barcode, BarChart3, FileSpreadsheet, IndianRupee, Lock, Palette, Printer, RefreshCw, ScanLine, ShieldCheck, Smartphone, Sparkles, Warehouse, Zap,
} from "lucide-react";
import { QR_TYPES } from "@/lib/qr-types";
import { TypeIcon } from "@/components/icon";
import { LinkButton } from "@/components/ui";
import { QuickGenerator } from "@/components/home/quick-generator";
import { getSettings } from "@/lib/settings";
import { renderQr } from "@/lib/qr-render";
import { TEMPLATES } from "@/lib/templates";

export default async function HomePage() {
  const settings = await getSettings();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: settings.siteName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    description: settings.tagline,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Hero + generator */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
          <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" /> 26 QR types · 20+ barcodes · UPI · Inventory · Free
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
              Smart QR codes for <span className="gradient-text">India</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
              Create beautiful, scannable QR codes for UPI payments, menus, Wi-Fi, WhatsApp and more. Edit dynamic codes after printing and see who scans them.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <LinkButton href="/upi" size="lg" variant="gradient"><IndianRupee className="h-4 w-4" /> Create UPI payment QR</LinkButton>
              <LinkButton href="/generator" size="lg" variant="outline">All QR types <ArrowRight className="h-4 w-4" /></LinkButton>
            </div>
            <p className="mt-4 text-xs text-slate-500">No sign-up needed for static QR codes · No watermark · Unlimited downloads</p>
          </div>
          <div className="mx-auto mt-12 max-w-5xl">
            <QuickGenerator />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Everything you need, nothing you don&apos;t</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">From a single shop counter QR to thousands of codes for a campaign.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: IndianRupee, title: "UPI payment QR", text: "Standards-compatible upi://pay codes for GPay, PhonePe, Paytm & BHIM — fixed or open amount, with printable standees.", href: "/upi" },
            { icon: Palette, title: "Design studio", text: "Gradients, rounded modules, custom eyes, logos, frames and captions — every change is test-scanned automatically.", href: "/studio" },
            { icon: RefreshCw, title: "Dynamic QR codes", text: "Change the destination after printing, pause campaigns, set expiry dates and add UTM tags.", href: "/dynamic" },
            { icon: BarChart3, title: "Scan analytics", text: "Daily trends, devices, browsers and countries — privacy-first, with no raw IPs stored.", href: "/analytics" },
            { icon: FileSpreadsheet, title: "Bulk generation", text: "Upload CSV or Excel, map columns, validate every row and download a ZIP or print sheet.", href: "/bulk" },
            { icon: ScanLine, title: "Universal scanner", text: "QR codes and barcodes (EAN, UPC, Code 128, Data Matrix, PDF417…) by camera or image, with scam warnings and product lookup.", href: "/scanner" },
            { icon: Barcode, title: "Barcodes & product labels", text: "EAN-13, UPC, Code 128, ITF-14, GS1-128 and more with check-digit validation, label printing and bulk export.", href: "/barcodes" },
            { icon: Warehouse, title: "Inventory", text: "Products, SKUs, stock in/out, low-stock alerts and CSV/Excel import — scan a barcode to find any item.", href: "/inventory" },
          ].map((f) => (
            <Link key={f.title} href={f.href} className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white"><f.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{f.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Types */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="card overflow-hidden p-8 sm:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight">{QR_TYPES.length} QR types, one place</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">Each with its own form, validation and live preview.</p>
            </div>
            <LinkButton href="/generator" variant="outline">Open generator <ArrowRight className="h-4 w-4" /></LinkButton>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {QR_TYPES.map((t) => (
              <Link key={t.id} href={t.id === "upi" ? "/upi" : `/generator?type=${t.id}`} className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-sm font-medium transition hover:border-brand hover:bg-brand/5 dark:border-slate-800">
                <TypeIcon name={t.icon} className="h-4 w-4 shrink-0 text-brand" /> <span className="truncate">{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* UPI */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold text-brand">Built for Indian shops</span>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Accept UPI with a QR you design</h2>
            <ul className="mt-6 space-y-4">
              {[
                [Zap, "Instant", "Enter your UPI ID and name — your QR is ready in seconds, free."],
                [Printer, "Print-ready standee", "A4/A5 PDF with your shop name, amount and UPI ID — ready for the counter."],
                [Smartphone, "Works with every UPI app", "Customers check the verified payee name and pay with their own PIN."],
                [Lock, "Honest by design", "We never see your money, PIN or OTP. A scan is never shown as a payment."],
              ].map(([Icon, t, d]: any) => (
                <li key={t} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Icon className="h-5 w-5" /></span>
                  <div><p className="font-semibold">{t}</p><p className="text-sm text-slate-600 dark:text-slate-400">{d}</p></div>
                </li>
              ))}
            </ul>
            <LinkButton href="/upi" className="mt-8" size="lg">Make my UPI QR <ArrowRight className="h-4 w-4" /></LinkButton>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute inset-0 -z-10 rotate-6 rounded-[2rem] bg-brand-gradient opacity-20 blur-xl" />
            <div className="card animate-float overflow-hidden rounded-[2rem] p-0">
              <div className="bg-[#ea580c] px-6 py-6 text-center text-white">
                <p className="font-display text-2xl font-extrabold">SCAN &amp; PAY</p>
                <p className="text-sm text-white/85">Pay with any UPI app</p>
              </div>
              <div className="p-6 text-center">
                <p className="font-display text-xl font-bold">Sharma General Store</p>
                {/* Deliberately not a payment QR: it decodes to an "example" note so nobody pays a stranger by scanning the demo. */}
                <div className="mx-auto mt-4 w-48 rounded-2xl border-4 border-[#ea580c]/20 p-2 [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: renderQr("Example only — make your own UPI QR at QRSathi /upi", { ...TEMPLATES.find((t) => t.id === "pay-here")!.design, frame: "none", margin: 1 }, { idPrefix: "hero" }).svg }} />
                <p className="mt-4 font-mono text-sm text-slate-500">UPI ID: yourshop@upi</p>
                <p className="mt-1 text-[11px] text-slate-400">Example standee — the code shown is not a payment QR</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Static vs dynamic */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card p-8">
            <p className="text-sm font-semibold text-sky-600">Static QR</p>
            <h3 className="mt-1 font-display text-2xl font-bold">Free forever, no account</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">The content lives inside the code. Works offline and never expires — but can&apos;t be changed after printing.</p>
          </div>
          <div className="card relative overflow-hidden p-8">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/10" />
            <p className="text-sm font-semibold text-violet-600">Dynamic QR</p>
            <h3 className="mt-1 font-display text-2xl font-bold">Editable + trackable</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Encodes a short link on this service. Change the destination anytime and see scan analytics. Needs this service to stay online.</p>
            <LinkButton href="/generator?type=dynamic" className="mt-5" variant="outline">Create a dynamic QR</LinkButton>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-8 py-14 text-center text-white">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
          <ShieldCheck className="mx-auto h-10 w-10 text-white/80" />
          <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">Start free in seconds</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">Save your codes, create dynamic links and hosted pages, and track scans with a free account.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100">Create free account</Link>
            <Link href="/pricing" className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-white/10">See pricing</Link>
          </div>
        </div>
      </section>
    </>
  );
}
