"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { formatMoney } from "@/lib/plans";
import { formatDate } from "@/lib/utils";
import { Alert, Badge, Button, ConfirmDialog, LinkButton, Section, Skeleton } from "@/components/ui";
import { useApp } from "@/components/providers";

interface Billing {
  plan: string; planExpiresAt: string | null;
  subscription: null | { id: string; planName: string; interval: string; amount: number; currency: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; createdAt: string };
  payments: { id: string; createdAt: string; planName: string; interval: string; amount: number; currency: string; status: string; refundedAmount: number; kind: string }[];
}

const SUB_LABEL: Record<string, { text: string; tone: "green" | "amber" | "rose" | "slate" | "blue" }> = {
  active: { text: "Active", tone: "green" }, authenticated: { text: "Awaiting first payment", tone: "blue" }, created: { text: "Checkout not completed", tone: "slate" },
  pending: { text: "Payment retrying", tone: "amber" }, halted: { text: "Payment failed", tone: "rose" }, cancelled: { text: "Cancelled", tone: "slate" },
  completed: { text: "Completed", tone: "slate" }, expired: { text: "Expired", tone: "slate" },
};
const PAY_TONE: Record<string, "green" | "amber" | "rose" | "slate"> = { paid: "green", failed: "rose", refunded: "slate", partially_refunded: "amber", created: "amber", pending: "amber" };

/** The customer's subscription status, cancellation and payment history (read from the server's records). */
export function BillingSection() {
  const { refreshUser } = useApp();
  const [b, setB] = useState<Billing | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => api<Billing>("/api/billing", { cache: "no-store" }).then(setB).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const cancel = async () => {
    setBusy(true);
    try {
      await api("/api/billing/cancel", { method: "POST", json: { atPeriodEnd: true } });
      toast.success("Cancellation confirmed", { description: "You keep your plan until the end of the paid period. You won't be charged again." });
      setConfirm(false);
      await load();
      refreshUser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't cancel");
    } finally {
      setBusy(false);
    }
  };

  const s = b?.subscription;
  const live = s && ["active", "authenticated", "pending"].includes(s.status);
  return (
    <Section id="billing" title="Billing" description="Subscriptions are handled by Razorpay. Your plan changes only after Razorpay confirms a payment.">
      {error ? <Alert tone="error">{error}</Alert> : !b ? <Skeleton className="h-24" /> : (
        <div className="space-y-5">
          {s ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{s.planName} · {formatMoney(s.amount, s.currency)} / {s.interval === "year" ? "year" : "month"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge tone={SUB_LABEL[s.status]?.tone ?? "slate"}>{SUB_LABEL[s.status]?.text ?? s.status}</Badge>
                  {s.cancelAtPeriodEnd && <Badge tone="amber">Ends at period end</Badge>}
                  {s.currentPeriodEnd && <span>{s.cancelAtPeriodEnd || s.status === "cancelled" ? "Access until" : "Renews"} {formatDate(s.currentPeriodEnd)}</span>}
                </div>
                {s.status === "pending" && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Razorpay couldn&apos;t charge your last renewal and will retry. Update your payment method from the link in Razorpay&apos;s e-mail.</p>}
                {s.status === "halted" && <p className="mt-2 text-xs text-rose-700 dark:text-rose-400">Renewal payments failed, so paid features were paused. Choose a plan again to resubscribe.</p>}
              </div>
              <div className="flex gap-2">
                {live && !s.cancelAtPeriodEnd && <Button variant="outline" onClick={() => setConfirm(true)}>Cancel subscription</Button>}
                {!live && <LinkButton href="/pricing" variant="outline">Choose a plan</LinkButton>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-300">{b.plan === "free" ? "You're on the Free plan. No payment method is stored." : "Your plan was set by an administrator; there's no subscription to manage."}</p>
              <LinkButton href="/pricing" variant="outline">See plans</LinkButton>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium">Payment history</h3>
            {b.payments.length === 0 ? <p className="text-sm text-slate-500">No payments yet.</p> : (
              <div className="relative -mx-5 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <caption className="sr-only">Payment history</caption>
                  <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800"><th scope="col" className="py-2 pl-5 font-medium">Date</th><th scope="col" className="py-2 font-medium">Plan</th><th scope="col" className="py-2 font-medium">Amount</th><th scope="col" className="py-2 pr-5 font-medium">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {b.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pl-5 text-xs">{formatDate(p.createdAt)}</td>
                        <td className="py-2">{p.planName}{p.interval ? ` · ${p.interval === "year" ? "yearly" : "monthly"}` : p.kind === "payment_link" ? " · 30-day pass" : ""}</td>
                        <td className="py-2 tabular-nums">{formatMoney(p.amount, p.currency)}{p.refundedAmount > 0 && <span className="block text-xs text-slate-500">refunded {formatMoney(p.refundedAmount, p.currency)}</span>}</td>
                        <td className="py-2 pr-5"><Badge tone={PAY_TONE[p.status] ?? "slate"}>{p.status.replace("_", " ")}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Cancel your subscription?" confirmLabel="Cancel subscription" onConfirm={cancel} loading={busy}>
        You keep {s?.planName} until {s?.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "the end of the paid period"}. After that your account moves to the Free plan; your QR codes and data stay.
      </ConfirmDialog>
    </Section>
  );
}
