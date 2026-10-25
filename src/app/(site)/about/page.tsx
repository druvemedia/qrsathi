import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Barcode, Boxes, IndianRupee, Megaphone, QrCode, Store, UtensilsCrossed } from "lucide-react";
import { CtaBand } from "@/components/marketing";
import { getSettings } from "@/lib/settings";
import { mergeDesign, renderQr } from "@/lib/qr-render";
import { TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = { title: "About", description: "What the product is, who it is for, and the principles it is built on." };

const PRINCIPLES: [string, string][] = [
  ["Accuracy first", "Every code is decoded again before download; barcodes are checked against their check-digit rules."],
  ["Plain about payments", "A UPI QR is a payment request, not proof of payment. We never handle money or ask for PINs."],
  ["Privacy by default", "No raw IP addresses in analytics, and detailed tracking can be switched off per code."],
  ["Clear limits", "Plans list exactly what they include, and the server enforces the same limits."],
];

export default async function AboutPage() {
  const { branding: b } = await getSettings();
  const qr = renderQr("https://example.com", mergeDesign({ ...TEMPLATES.find((t) => t.id === "classic")!.design, margin: 1 }), { idPrefix: "about" }).svg;
  return (
    <>
      <header className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 lg:pt-24">
        <p className="text-sm font-medium text-brand">About {b.brandName}</p>
        <h1 className="mt-4 max-w-4xl animate-page-in font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl">
          A practical toolkit for codes that go on <em className="italic text-brand">real things</em>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">{b.homeDescription}</p>
      </header>

      {/* The problem */}
      <section className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" aria-labelledby="problem">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 id="problem" className="font-serif text-4xl leading-[1.08] tracking-[-0.02em]">Printing is permanent. Most details aren&apos;t.</h2>
            <p className="mt-5 max-w-lg text-zinc-600 dark:text-zinc-400">Menus change, links move and stock runs out — but the sticker on the table stays. {b.brandName} makes codes that are checked before print, editable after it, and connected to the products they label.</p>
          </div>
          <div className="relative mx-auto w-full max-w-xs" aria-hidden>
            <div className="rounded-3xl bg-zinc-100 p-6 dark:bg-zinc-900">
              <div className="mx-auto w-40 rounded-2xl bg-white p-3 shadow-pop [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="mt-5 space-y-2 text-xs">
                <p className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-zinc-400 line-through dark:bg-zinc-800/70">Old menu link</p>
                <p className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-medium shadow-sm dark:bg-zinc-800"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />New menu — same printed code</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="does">
        <h2 id="does" className="font-serif text-4xl tracking-[-0.02em]">What it does</h2>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-3xl bg-zinc-200 dark:bg-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: QrCode, t: "QR codes", d: "Static and dynamic, styled and test-scanned.", href: "/generator" },
            { icon: IndianRupee, t: "UPI payment QR", d: "Counter codes and printable standees.", href: "/upi" },
            { icon: Barcode, t: "Barcodes", d: "Retail, logistics and 2D formats, validated.", href: "/barcodes" },
            { icon: Boxes, t: "Products & stock", d: "Catalogue, stock movements and labels.", href: "/products" },
          ].map((c, i) => (
            <li key={c.t} className="bg-[#fbfbf9] dark:bg-[#0b0b0d]">
              <Link href={c.href} className="group flex h-full flex-col p-6 transition-colors hover:bg-white dark:hover:bg-zinc-900">
                <span className="font-mono text-xs text-zinc-400">{String(i + 1).padStart(2, "0")}</span>
                <c.icon className="mt-6 h-6 w-6 text-brand" aria-hidden />
                <h3 className="mt-3 font-semibold">{c.t}</h3>
                <p className="mt-1 flex-1 text-sm text-zinc-500">{c.d}</p>
                <ArrowRight className="mt-4 h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="for">
        <h2 id="for" className="font-serif text-4xl tracking-[-0.02em]">Who it&apos;s for</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            { icon: Store, t: "Shops & counters", d: "A UPI QR on the counter and barcodes on the shelf." },
            { icon: UtensilsCrossed, t: "Restaurants & cafés", d: "Menus that change more often than table cards are reprinted." },
            { icon: Megaphone, t: "Creators & campaigns", d: "Posters and packaging where you need to know scans are happening." },
          ].map((a) => (
            <div key={a.t} className="border-t-2 border-zinc-900 pt-5 dark:border-white">
              <a.icon className="h-5 w-5 text-zinc-500" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">{a.t}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{a.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-sm text-zinc-500">The QR and barcode generators, UPI QR and scanner work without an account. An account adds a library, dynamic codes, analytics, products and inventory.</p>
      </section>

      {/* Principles */}
      <section className="bg-zinc-950 text-white" aria-labelledby="principles">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-[1fr_2fr]">
          <h2 id="principles" className="font-serif text-4xl leading-[1.08] tracking-[-0.02em]">How we build it</h2>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {PRINCIPLES.map(([t, d], i) => (
              <div key={t}>
                <dt className="flex items-baseline gap-3 font-semibold"><span className="font-mono text-xs text-white/40">{String(i + 1).padStart(2, "0")}</span>{t}</dt>
                <dd className="mt-2 pl-8 text-sm leading-relaxed text-white/60">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {(b.companyName || b.contactAddress) && (
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="company">
          <div className="flex flex-col gap-2 border-l-2 border-brand pl-6">
            <h2 id="company" className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Company</h2>
            <p className="font-serif text-2xl">{b.companyName}</p>
            {b.contactAddress && <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{b.contactAddress}</p>}
          </div>
        </section>
      )}
      <CtaBand title="Questions? We're happy to help." primary={["/contact", "Contact us"]} secondary={["/help", "Visit the help centre"]} />
    </>
  );
}
