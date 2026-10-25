import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { UpgradeButton } from "./upgrade-button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free static QR codes forever. Upgrade for more dynamic QR codes, hosted pages, custom aliases, bulk generation and longer analytics.",
};

const ROWS: [string, (p: (typeof PLANS)[keyof typeof PLANS]) => string][] = [
  ["Static QR codes & downloads", () => "Unlimited"],
  ["Dynamic QR codes", (p) => p.dynamicLimit.toLocaleString("en-IN")],
  ["Hosted pages (menus, link-in-bio…)", (p) => p.hostedLimit.toLocaleString("en-IN")],
  ["Saved QR library", (p) => p.savedLimit.toLocaleString("en-IN")],
  ["Products & inventory items", (p) => p.productLimit.toLocaleString("en-IN")],
  ["Bulk rows per batch", (p) => p.bulkRows.toLocaleString("en-IN")],
  ["Analytics history", (p) => `${p.analyticsDays} days`],
  ["Custom short-link alias", (p) => (p.customAlias ? "✓" : "—")],
  ["Expiry dates", (p) => (p.expiry ? "✓" : "—")],
  ["File upload size", (p) => `${p.uploadMb} MB`],
];

export default function PricingPage() {
  const plans = Object.values(PLANS);
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Simple, honest pricing</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Static QR codes are free forever — including UPI payment QR. Pay only for dynamic links, hosted pages and scale.</p>
      </div>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {plans.map((p) => {
          const hi = p.id === "pro";
          return (
            <div key={p.id} className={cn("card relative flex flex-col p-7", hi && "border-brand ring-2 ring-brand/20 lg:-mt-3 lg:mb-3")}>
              {hi && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3 py-1 text-xs font-bold text-white">Most popular</span>}
              <h2 className="font-display text-xl font-bold">{p.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
              <p className="mt-5"><span className="font-display text-4xl font-extrabold">₹{p.priceInr}</span><span className="text-slate-500">{p.priceInr ? " / month" : " forever"}</span></p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {f}</li>)}
              </ul>
              <div className="mt-7"><UpgradeButton plan={p.id} highlight={hi} /></div>
            </div>
          );
        })}
      </div>

      <div className="card mt-16 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr><th className="px-5 py-3 text-left">Compare plans</th>{plans.map((p) => <th key={p.id} className="px-5 py-3 text-center">{p.name}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ROWS.map(([label, fn]) => (
                <tr key={label}><td className="px-5 py-3 text-slate-600 dark:text-slate-300">{label}</td>{plans.map((p) => <td key={p.id} className="px-5 py-3 text-center font-medium">{fn(p)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-slate-500">
        Prices in INR, inclusive of applicable taxes. Paid plans are 30-day passes billed through Razorpay; your plan changes only after the payment provider confirms payment. Cancel any time — it simply won&apos;t renew. Dynamic QR codes keep redirecting if you downgrade; you just can&apos;t create more above the Free limit.
      </p>
    </div>
  );
}
