"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { Button } from "@/components/ui";
import { useApp } from "@/components/providers";
import type { PlanId } from "@/lib/plans";

export function UpgradeButton({ plan, highlight }: { plan: PlanId; highlight?: boolean }) {
  const { user } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (plan === "free") {
    return user ? (
      <Button variant="outline" className="w-full" disabled>{user.plan === "free" ? "Current plan" : "Included"}</Button>
    ) : (
      <Button variant="outline" className="w-full" onClick={() => router.push("/signup")}>Start free</Button>
    );
  }
  if (user?.plan === plan) return <Button variant="outline" className="w-full" disabled>Current plan</Button>;

  const go = async () => {
    if (!user) return router.push(`/signup?next=/pricing`);
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST", json: { plan } });
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setBusy(false);
    }
  };
  return (
    <Button variant={highlight ? "gradient" : "primary"} className="w-full" onClick={go} loading={busy}>
      {user ? `Upgrade to ${plan === "pro" ? "Pro" : "Business"}` : "Get started"}
    </Button>
  );
}
