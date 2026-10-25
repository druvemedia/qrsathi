"use client";
import Link from "next/link";
import { Info } from "lucide-react";
import { ComparisonTable, IntervalSwitch, PricingCards, usePricingInterval } from "@/components/pricing/pricing-cards";
import { isPaid, type Plan } from "@/lib/plans";
import { useApp } from "@/components/providers";

export function PricingView({ plans, checkoutAvailable }: { plans: Plan[]; checkoutAvailable: boolean }) {
  const { settings } = useApp();
  const { interval, setInterval, both, maxSave } = usePricingInterval(plans);
  const paid = plans.filter(isPaid);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:pt-24">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-brand">Pricing</p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">Start free. Pay when you need more.</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">Static QR codes, UPI payment QR and the scanner are free without limits. Paid plans add dynamic codes, hosted pages, larger inventories and longer analytics.</p>
      </header>

      {plans.length === 0 ? (
        <div className="mt-12 rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Plans are being updated</h2>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">There are no plans to show right now. Every account can keep using the free tools — the QR generator, barcode generator, UPI QR and scanner.</p>
          <Link href="/generator" className="mt-4 inline-flex text-sm font-medium text-brand hover:underline">Open the QR generator →</Link>
        </div>
      ) : (
        <>
          {both && <div className="mt-10"><IntervalSwitch interval={interval} setInterval={setInterval} maxSave={maxSave} /></div>}
          <div className="mt-8"><PricingCards plans={plans} interval={interval} /></div>
          {paid.length > 0 && !checkoutAvailable && (
            <p className="mt-6 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Online payment is temporarily unavailable. {settings.supportEmail ? <>Write to <a className="text-brand hover:underline" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a> to upgrade.</> : "Please check back soon."}
            </p>
          )}
          <section className="mt-20" aria-labelledby="compare">
            <h2 id="compare" className="font-serif text-2xl tracking-tight sm:text-3xl">Compare plans</h2>
            <p className="mt-2 text-sm text-zinc-500">Generated from the limits each plan enforces — the same rules the app applies.</p>
            <div className="mt-6"><ComparisonTable plans={plans} /></div>
          </section>
        </>
      )}

      <section className="mt-16 grid gap-8 border-t border-zinc-200 pt-10 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 md:grid-cols-3">
        <div><h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Billing</h3><p className="mt-2">Paid plans renew automatically through Razorpay each month or year until you cancel. Your plan changes only after Razorpay confirms the payment.</p></div>
        <div><h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Taxes</h3><p className="mt-2">Prices are shown in the plan&apos;s currency. Applicable taxes, if any, are shown by Razorpay before you pay.</p></div>
        <div><h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Cancelling</h3><p className="mt-2">Cancel any time in Settings → Billing; you keep the plan until the end of the paid period. Dynamic QR codes keep redirecting after a downgrade.</p></div>
      </section>
    </div>
  );
}
