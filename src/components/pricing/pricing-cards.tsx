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

/** The three limits people compare first, shown on each card. */
const AT_A_GLANCE: { label: string; value: (p: Plan) => string }[] = [
  { label: "Dynamic QR", value: (p) => p.limits.dynamic.toLocaleString("en-IN") },
  { label: "Hosted pages", value: (p) => p.limits.hosted.toLocaleString("en-IN") },
  { label: "Products", value: (p) => p.limits.products.toLocaleString("en-IN") },
];

export function PricingCards({ plans, interval, preview = false }: { plans: Plan[]; interval: Interval; preview?: boolean }) {
  const cols = plans.length >= 4 ? "lg:grid-cols-4" : plans.length === 3 ? "lg:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : "";
  return (
    <div className={cn("grid items-stretch gap-4 md:gap-5", cols)}>
      {plans.map((p) => {
        const pl = priceLine(p, interval);
        const hi = p.featured;
        return (
          <article key={p.id} className={cn("group relative flex flex-col rounded-[1.75rem] p-6 transition duration-200 hover:-translate-y-1 sm:p-7",
            hi ? "bg-zinc-950 text-white shadow-[0_30px_60px_-30px_hsl(var(--brand)/0.6)] ring-1 ring-zinc-900 dark:bg-white dark:text-zinc-950 dark:ring-white"
              : "border border-zinc-200 bg-white hover:shadow-pop dark:border-zinc-800 dark:bg-zinc-900")}>
            {hi && <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-70 dark:opacity-0" aria-hidden style={{ background: "radial-gradient(70% 50% at 100% 0%, hsl(var(--brand) / .45), transparent 70%)" }} />}
            <div className="relative flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">{p.name}</h3>
              {hi && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-white/25 dark:bg-brand/10 dark:text-brand dark:ring-brand/20">Recommended</span>}
              {preview && p.status !== "published" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{p.status}</span>}
            </div>
            {p.description && <p className={cn("relative mt-1 text-sm", hi ? "text-white/65 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400")}>{p.description}</p>}
            <p className="relative mt-6 flex items-baseline gap-1.5">
              <span key={pl.amount} className="animate-fade-in font-serif text-5xl tracking-tight tabular-nums">{pl.amount}</span>
              <span className={cn("text-sm", hi ? "text-white/60 dark:text-zinc-500" : "text-zinc-500")}>{pl.per}</span>
            </p>
            <p className={cn("relative mt-1 h-4 text-xs", hi ? "text-white/60 dark:text-zinc-500" : "text-zinc-500")}>{pl.note}</p>
            <dl className={cn("relative mt-5 grid grid-cols-3 gap-2 rounded-2xl p-3 text-center", hi ? "bg-white/[0.07] dark:bg-zinc-100" : "bg-zinc-50 dark:bg-zinc-800/60")}>
              {AT_A_GLANCE.map((g) => (
                <div key={g.label}>
                  <dd className="text-base font-semibold tabular-nums">{g.value(p)}</dd>
                  <dt className={cn("text-[10px] uppercase tracking-wide", hi ? "text-white/55 dark:text-zinc-500" : "text-zinc-500")}>{g.label}</dt>
                </div>
              ))}
            </dl>
            <div className="relative mt-5">{preview ? <Button className="w-full" variant={hi ? "primary" : "outline"} disabled>Preview</Button> : <PlanAction plan={p} interval={(pl.interval ?? interval) as Interval} />}</div>
            <ul className={cn("relative mt-5 space-y-2.5 border-t pt-5 text-sm", hi ? "border-white/10 dark:border-zinc-200" : "border-zinc-100 dark:border-zinc-800")}>
              {p.features.map((ft) => (
                <li key={ft} className="flex gap-2.5"><Check className={cn("mt-0.5 h-4 w-4 shrink-0", hi ? "text-emerald-300 dark:text-brand" : "text-brand")} aria-hidden /> <span>{ft}</span></li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

const GROUPS: { title: string; rows: string[] }[] = [
  { title: "QR codes", rows: ["Static QR codes & downloads", "Saved QR codes", "Dynamic QR codes", "Hosted pages", "Custom short-link alias", "Expiry dates"] },
  { title: "Analytics", rows: ["Scan analytics history", "Analytics CSV export"] },
  { title: "Products & bulk", rows: ["Products & inventory items", "Stored product barcodes", "Rows per bulk batch"] },
  { title: "Storage & support", rows: ["Largest upload / total storage", "Priority support"] },
];

export function ComparisonTable({ plans }: { plans: Plan[] }) {
  const byLabel = Object.fromEntries(COMPARISON.map((r) => [r.label, r]));
  // Rows added to COMPARISON later still appear, in an "Other" group.
  const grouped = GROUPS.map((g) => ({ ...g, rows: g.rows.filter((l) => byLabel[l]) }));
  const known = new Set(GROUPS.flatMap((g) => g.rows));
  const other = COMPARISON.filter((r) => !known.has(r.label)).map((r) => r.label);
  if (other.length) grouped.push({ title: "Other", rows: other });
  const featured = plans.findIndex((p) => p.featured);
  const cell = (i: number) => cn("px-4 py-3 text-center tabular-nums", i === featured && "bg-brand/[0.05] dark:bg-brand/[0.08]");
  return (
    <div className="relative overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Plan comparison</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-[#fbfbf9] px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-[#0b0b0d]">Included</th>
            {plans.map((p, i) => (
              <th key={p.id} scope="col" className={cn("px-4 py-4 text-center font-semibold", i === featured && "rounded-t-2xl bg-brand/[0.05] text-brand dark:bg-brand/[0.08]")}>{p.name}</th>
            ))}
          </tr>
        </thead>
        {grouped.map((g) => (
          <tbody key={g.title}>
            <tr>
              <th scope="colgroup" colSpan={plans.length + 1} className="sticky left-0 border-b border-zinc-200 bg-[#fbfbf9] px-4 pb-2 pt-6 text-left font-serif text-lg font-medium dark:border-zinc-800 dark:bg-[#0b0b0d]">{g.title}</th>
            </tr>
            {g.rows.map((label) => (
              <tr key={label} className="group">
                <th scope="row" className="sticky left-0 z-10 border-b border-zinc-100 bg-[#fbfbf9] px-4 py-3 text-left font-normal text-zinc-600 group-hover:text-zinc-950 dark:border-zinc-800/70 dark:bg-[#0b0b0d] dark:text-zinc-300 dark:group-hover:text-white">{label}</th>
                {plans.map((p, i) => {
                  const v = byLabel[label].value(p.limits);
                  return (
                    <td key={p.id} className={cn(cell(i), "border-b border-zinc-100 dark:border-zinc-800/70")}>
                      {v === "—" ? <Minus className="mx-auto h-4 w-4 text-zinc-300 dark:text-zinc-600" aria-label="Not included" />
                        : v === "Included" ? <Check className="mx-auto h-4 w-4 text-brand" aria-label="Included" /> : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
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
