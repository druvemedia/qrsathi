"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { Button, Segmented } from "@/components/ui";
import { useApp } from "@/components/providers";
import { COMPARISON, annualDiscount, formatMoney, intervalsOf, isPaid, type Interval, type Plan } from "@/lib/plans";
import { cn } from "@/lib/utils";

/** Interval switch is offered only when at least one paid plan has both prices configured. */
export function usePricingInterval(plans: Plan[]) {
  const both = plans.some((p) => p.monthlyPrice > 0 && p.annualPrice > 0);
  const anyYearOnly = plans.some((p) => !p.monthlyPrice && p.annualPrice);
  const [interval, setInterval] = useState<Interval>(anyYearOnly && !plans.some((p) => p.monthlyPrice) ? "year" : "month");
  const maxSave = Math.max(0, ...plans.map((p) => annualDiscount(p) ?? 0));
  return { interval, setInterval, both, maxSave };
}

export function IntervalSwitch({ interval, setInterval, maxSave }: { interval: Interval; setInterval: (i: Interval) => void; maxSave: number }) {
  return (
    <Segmented value={interval} onChange={setInterval}
      options={[{ value: "month", label: "Monthly" }, { value: "year", label: <span>Yearly{maxSave > 0 && <span className="ml-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">save up to {maxSave}%</span>}</span> }]} />
  );
}

function priceLine(p: Plan, interval: Interval) {
  if (!isPaid(p)) return { amount: formatMoney(0, p.currency), per: "forever", note: "" };
  const offered = intervalsOf(p);
  const i = offered.includes(interval) ? interval : offered[0];
  const amount = i === "month" ? p.monthlyPrice : p.annualPrice;
  const note = i !== interval ? (i === "month" ? "Billed monthly only" : "Billed yearly only") : i === "year" && p.monthlyPrice ? `${formatMoney(Math.round(p.annualPrice / 12), p.currency)} / month, billed yearly` : "";
  return { amount: formatMoney(amount, p.currency), per: i === "month" ? "per month" : "per year", note, interval: i };
}

export function PricingCards({ plans, interval, preview = false }: { plans: Plan[]; interval: Interval; preview?: boolean }) {
  const cols = plans.length >= 4 ? "lg:grid-cols-4" : plans.length === 3 ? "lg:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : "";
  return (
    <div className={cn("grid gap-4 md:gap-5", cols)}>
      {plans.map((p) => {
        const pl = priceLine(p, interval);
        return (
          <article key={p.id} className={cn("relative flex flex-col rounded-xl border bg-white p-6 transition-shadow dark:bg-zinc-900 sm:p-7",
            p.featured ? "border-brand/60 shadow-[0_1px_0_0_hsl(var(--brand)/0.4),0_12px_32px_-16px_hsl(var(--brand)/0.35)]" : "border-zinc-200 dark:border-zinc-800")}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">{p.name}</h3>
              {p.featured && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">Recommended</span>}
              {preview && p.status !== "published" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{p.status}</span>}
            </div>
            {p.description && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{p.description}</p>}
            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">{pl.amount}</span>
              <span className="text-sm text-zinc-500">{pl.per}</span>
            </p>
            <p className="mt-1 h-4 text-xs text-zinc-500">{pl.note}</p>
            <div className="mt-6">{preview ? <Button className="w-full" variant={p.featured ? "primary" : "outline"} disabled>Preview</Button> : <PlanAction plan={p} interval={(pl.interval ?? interval) as Interval} />}</div>
            <ul className="mt-6 space-y-2.5 border-t border-zinc-100 pt-6 text-sm dark:border-zinc-800">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> <span>{f}</span></li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

export function ComparisonTable({ plans }: { plans: Plan[] }) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Plan comparison</caption>
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th scope="col" className="px-5 py-3.5 text-left font-medium text-zinc-500">Included</th>
            {plans.map((p) => <th key={p.id} scope="col" className="px-5 py-3.5 text-center font-semibold">{p.name}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {COMPARISON.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="px-5 py-3 text-left font-normal text-zinc-600 dark:text-zinc-300">{row.label}</th>
              {plans.map((p) => {
                const v = row.value(p.limits);
                return <td key={p.id} className="px-5 py-3 text-center tabular-nums">{v === "—" ? <Minus className="mx-auto h-4 w-4 text-zinc-300 dark:text-zinc-600" aria-label="Not included" /> : v}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

declare global { interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: any) => void) => void } } }

function loadCheckout() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Razorpay Checkout. Check your connection and try again."));
    document.head.appendChild(s);
  });
}

type Phase = "idle" | "preparing" | "waiting" | "confirming";
const PHASE_LABEL: Record<Phase, string> = { idle: "", preparing: "Preparing checkout…", waiting: "Complete payment in the Razorpay window…", confirming: "Confirming payment…" };

/** Starts a subscription. Only identifiers are sent; the server decides the price. */
function PlanAction({ plan, interval }: { plan: Plan; interval: Interval }) {
  const { user } = useApp();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const current = user?.plan === plan.id;
  const free = !isPaid(plan);

  const label = useMemo(() => (current ? "Current plan" : free ? (user ? "Included" : "Start free") : user ? `Choose ${plan.name}` : "Get started"), [current, free, user, plan.name]);
  if (current) return <Button variant="outline" className="w-full" disabled>Current plan</Button>;
  if (free) return user ? <Button variant="outline" className="w-full" disabled>{label}</Button> : <Link href="/signup" className="flex h-10 w-full items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium transition-colors hover:bg-zinc-50 active:scale-[0.99] dark:border-zinc-700 dark:hover:bg-zinc-800">{label}</Link>;

  const start = async () => {
    if (!user) return router.push(`/signup?next=${encodeURIComponent("/pricing")}`);
    setPhase("preparing");
    try {
      const s = await api<{ keyId: string; subscriptionId: string; name: string; description: string; prefill: { name: string; email: string } }>("/api/billing/subscribe", { method: "POST", json: { planId: plan.id, interval } });
      await loadCheckout();
      setPhase("waiting");
      const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
      const rzp = new window.Razorpay!({
        key: s.keyId, subscription_id: s.subscriptionId, name: s.name, description: s.description, prefill: s.prefill,
        theme: { color: brand ? `hsl(${brand.replace(/ /g, ", ")})` : undefined },
        handler: async (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          setPhase("confirming");
          try {
            await api("/api/billing/verify", { method: "POST", json: r });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "We couldn't confirm the payment yet.");
          }
          router.push(`/billing/status?subscription=${encodeURIComponent(s.subscriptionId)}`);
        },
        modal: { ondismiss: () => setPhase("idle") },
      });
      rzp.on("payment.failed", (r: { error?: { description?: string } }) => {
        toast.error(r?.error?.description || "The payment didn't go through. You weren't charged for this attempt.");
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout");
      setPhase("idle");
    }
  };
  return (
    <div>
      <Button className="w-full" variant={plan.featured ? "primary" : "secondary"} onClick={start} loading={phase !== "idle"} disabled={phase !== "idle"}>{label}</Button>
      <p className="mt-2 h-4 text-center text-xs text-zinc-500" role="status" aria-live="polite">{PHASE_LABEL[phase]}</p>
    </div>
  );
}
