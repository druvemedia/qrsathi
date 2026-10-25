"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "@/lib/fetcher";
import { useApp } from "@/components/providers";
import { Alert, Card, LinkButton, Spinner } from "@/components/ui";

interface Status { state: string; planName: string; interval: string; currentPeriodEnd: string | null; failureReason: string }

/**
 * Shows the server's view of a checkout. Returning here does NOT activate anything:
 * the plan changes only when Razorpay's confirmation (API check or signed webhook) is recorded.
 */
export function CheckoutStatus() {
  const id = useSearchParams().get("subscription") || "";
  const { refreshUser } = useApp();
  const [s, setS] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let stop = false;
    let tries = 0;
    const tick = async () => {
      try {
        const r = await api<Status>(`/api/billing/status?subscription=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (stop) return;
        setS(r);
        if (r.state === "active") { refreshUser(); return; }
        if (r.state !== "pending") return;
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Couldn't load the payment status");
        return;
      }
      if (++tries > 40) { setTimedOut(true); return; }
      setTimeout(tick, tries < 10 ? 2000 : 5000);
    };
    tick();
    return () => { stop = true; };
  }, [id, refreshUser]);

  if (error) return <Alert tone="error" title="Couldn't load the payment status">{error}</Alert>;
  if (!s) return <div className="flex items-center gap-3 text-sm text-slate-500"><Spinner /> Checking with the payment provider…</div>;

  const until = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <Card className="max-w-xl animate-fade-up p-6">
      {s.state === "active" ? (
        <>
          <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">You&apos;re on {s.planName}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Razorpay confirmed the payment.{until && ` Your plan renews ${s.interval === "year" ? "yearly" : "monthly"}; current period ends ${until}.`}</p>
          <LinkButton href="/dashboard" className="mt-5">Go to dashboard</LinkButton>
        </>
      ) : s.state === "failed" ? (
        <>
          <XCircle className="h-8 w-8 text-rose-600" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">The payment didn&apos;t go through</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.failureReason || "Your bank or Razorpay declined it."} Your plan hasn&apos;t changed.</p>
          <LinkButton href="/pricing" className="mt-5" variant="outline">Try again</LinkButton>
        </>
      ) : s.state === "pending" ? (
        <>
          <Clock className="h-8 w-8 text-amber-600" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">{timedOut ? "Still waiting for confirmation" : "Confirming your payment…"}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {timedOut
              ? "Razorpay hasn't confirmed the payment yet. This can take a few minutes. Your plan updates automatically once it's confirmed — you can close this page."
              : "Waiting for Razorpay to confirm. Please keep this page open for a moment."}
          </p>
          {!timedOut && <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-1/3 animate-progress rounded-full bg-brand" /></div>}
          <LinkButton href="/dashboard/settings#billing" className="mt-5" variant="outline">View billing</LinkButton>
        </>
      ) : (
        <>
          <XCircle className="h-8 w-8 text-slate-500" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">Subscription {s.state}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">This subscription is no longer active.</p>
          <LinkButton href="/pricing" className="mt-5" variant="outline">See plans</LinkButton>
        </>
      )}
    </Card>
  );
}
