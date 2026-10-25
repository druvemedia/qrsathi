"use client";
import Link from "next/link";
import { Barcode, Info, QrCode, ScanLine, IndianRupee } from "lucide-react";
import { ComparisonTable, IntervalSwitch, PricingCards, usePricingInterval } from "@/components/pricing/pricing-cards";
import { isPaid, type Plan } from "@/lib/plans";
import { useApp } from "@/components/providers";

const FREE_TOOLS = [
  { icon: QrCode, label: "QR generator", href: "/generator" },
  { icon: Barcode, label: "Barcode generator", href: "/barcodes" },
  { icon: IndianRupee, label: "UPI payment QR", href: "/upi" },
  { icon: ScanLine, label: "Scanner", href: "/scanner" },
];

const FAQ: [string, string][] = [
  ["How does billing work?", "Paid plans are Razorpay subscriptions that renew each month or year until you cancel. Card and UPI details are entered on Razorpay, never on this site."],
  ["When does my plan change?", "Only after Razorpay confirms the payment to our server — not when you return from the payment window."],
  ["Are taxes included?", "Prices are shown in the plan's currency. Any applicable taxes are shown by Razorpay before you pay."],
  ["How do I cancel?", "Settings → Billing → Cancel subscription. You keep the plan until the end of the paid period."],
  ["What happens to my codes if I downgrade?", "Nothing is deleted and dynamic QR codes keep redirecting. You can't create more than the new plan allows until you're under its limits."],
];

export function PricingView({ plans, checkoutAvailable }: { plans: Plan[]; checkoutAvailable: boolean }) {
  const { settings } = useApp();
  const { interval, setInterval, both, maxSave } = usePricingInterval(plans);
  const paid = plans.filter(isPaid);
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]" aria-hidden
        style={{ background: "radial-gradient(50% 60% at 50% 0%, hsl(var(--brand) / .12), transparent 70%)" }} />
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:pt-24">
        <header className="mx-auto max-w-2xl animate-page-in text-center">
          <p className="text-sm font-medium text-brand">Pricing</p>
          <h1 className="mt-3 font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl">Start free. Pay when you need more.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">Paid plans add dynamic codes, hosted pages, bigger inventories and longer analytics.</p>
        </header>

        <ul className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2" aria-label="Free on every plan">
          {FREE_TOOLS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:shadow-card dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <t.icon className="h-3.5 w-3.5 text-brand" aria-hidden /> {t.label} <span className="text-emerald-700 dark:text-emerald-400">· free</span>
              </Link>
            </li>
          ))}
        </ul>

        {plans.length === 0 ? (
          <div className="mx-auto mt-14 max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-serif text-2xl">Plans are being updated</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">There are no plans to show right now. The QR generator, barcode generator, UPI QR and scanner stay free for everyone.</p>
            <Link href="/generator" className="mt-4 inline-flex text-sm font-medium text-brand hover:underline">Open the QR generator →</Link>
          </div>
        ) : (
          <>
            {both && <div className="mt-10 flex justify-center"><IntervalSwitch interval={interval} setInterval={setInterval} maxSave={maxSave} /></div>}
            <div className="mt-8"><PricingCards plans={plans} interval={interval} /></div>
            {paid.length > 0 && !checkoutAvailable && (
              <p className="mx-auto mt-6 flex max-w-2xl items-start justify-center gap-2 text-center text-sm text-zinc-600 dark:text-zinc-400" role="status">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>Online payment is temporarily unavailable. {settings.supportEmail ? <>Write to <a className="text-brand hover:underline" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a> to upgrade.</> : "Please check back soon."}</span>
              </p>
            )}
            <section className="mt-24" aria-labelledby="compare">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <h2 id="compare" className="font-serif text-3xl tracking-[-0.02em] sm:text-4xl">Compare plans</h2>
                <p className="text-sm text-zinc-500">The same limits the app enforces.</p>
              </div>
              <div className="mt-4"><ComparisonTable plans={plans} /></div>
            </section>
          </>
        )}

        <section className="mt-24 grid gap-10 md:grid-cols-[1fr_2fr]" aria-labelledby="pricing-faq">
          <h2 id="pricing-faq" className="font-serif text-3xl tracking-[-0.02em]">Billing questions</h2>
          <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-500 transition-transform duration-200 group-open:rotate-45 dark:border-zinc-700" aria-hidden>+</span>
                </summary>
                <p className="mt-3 max-w-2xl animate-fade-up text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
