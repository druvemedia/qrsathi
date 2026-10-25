"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Check, Copy, IndianRupee, Info, Printer, Save, ShieldAlert, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { getType, validateContent } from "@/lib/qr-types";
import { mergeDesign, type QrDesign } from "@/lib/qr-render";
import { TEMPLATES } from "@/lib/templates";
import { builtinLogo } from "@/lib/logos";
import { parseUpiUri, upiWarnings } from "@/lib/upi";
import { api } from "@/lib/fetcher";
import { Alert, Button, Card, Field, Input, Segmented, Tabs } from "@/components/ui";
import { useApp } from "@/components/providers";
import { QrPreview } from "@/components/qr/preview";
import { DesignPanel } from "@/components/qr/design-panel";
import { ExportPanel, PosterDialog } from "@/components/qr/export-panel";
import { cn } from "@/lib/utils";

const UPI = getType("upi");
const KEY = "qrsathi:upi:v1";

export function UpiTool() {
  const { user } = useApp();
  const [data, setData] = useState({ vpa: "", name: "", amount: "", note: "", mc: "", tr: "" });
  const [display, setDisplay] = useState({ tagline: "", phone: "" });
  const [amountMode, setAmountMode] = useState<"open" | "fixed">("open");
  const [design, setDesign] = useState<QrDesign>(() => mergeDesign({ ...TEMPLATES.find((t) => t.id === "pay-here")!.design, logo: builtinLogo("rupee"), ecc: "H" }));
  const [tab, setTab] = useState<"details" | "design">("details");
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [poster, setPoster] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s?.data) setData((d) => ({ ...d, ...s.data }));
      if (s?.display) setDisplay(s.display);
      if (s?.amountMode) setAmountMode(s.amountMode);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ data, display, amountMode }));
    } catch {}
  }, [data, display, amountMode]);

  const input = useMemo(() => ({ ...data, amount: amountMode === "fixed" ? data.amount : "" }), [data, amountMode]);
  const v = useMemo(() => validateContent(UPI, input), [input]);
  // The schema treats amount as optional; a fixed-amount QR additionally requires one.
  const errors = { ...v.errors };
  if (amountMode === "fixed" && !data.amount) errors.amount = "Enter the amount, or switch to customer-entered amount";
  const ok = v.ok && !(amountMode === "fixed" && !data.amount);
  const payload = ok ? UPI.build(v.data, { hostedUrl: "" }) : "";
  const parsed = payload ? parseUpiUri(payload) : null;
  const warnings = upiWarnings({ am: input.amount });

  const set = (k: keyof typeof data, val: string) => setData((d) => ({ ...d, [k]: val }));
  const err = (k: string) => (touched.has(k) ? errors[k] : undefined);
  const blur = (k: string) => setTouched((t) => new Set(t).add(k));

  const copyVpa = () => {
    if (!data.vpa) return;
    navigator.clipboard.writeText(data.vpa.trim());
    setCopied(true);
    toast.success("UPI ID copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const save = async () => {
    if (!ok) {
      setTouched(new Set(Object.keys(data)));
      return toast.error("Please fix the highlighted fields.");
    }
    if (!user) return toast.info("Sign in to save this payment QR to your library.");
    setSaving(true);
    try {
      await api("/api/qrcodes", { method: "POST", json: { name: `UPI — ${data.name}`, type: "upi", content: input, design, dynamic: false } });
      toast.success("Saved to your library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const amountLabel = input.amount ? `₹ ${Number(input.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <Tabs className="px-3" value={tab} onChange={setTab} tabs={[{ value: "details", label: "Payment details" }, { value: "design", label: "Design" }]} />
          <div className="p-5">
            {tab === "details" ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="UPI ID (VPA)" htmlFor="upi-vpa" required error={err("vpa")} hint="e.g. yourshop@okaxis, 9876543210@ybl" className="sm:col-span-2">
                    <div className="flex gap-2">
                      <Input id="upi-vpa" value={data.vpa} onChange={(e) => set("vpa", e.target.value)} onBlur={() => blur("vpa")} invalid={!!err("vpa")} placeholder="yourshop@bank" autoComplete="off" spellCheck={false} />
                      <Button variant="outline" onClick={copyVpa} disabled={!data.vpa} aria-label="Copy UPI ID">{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</Button>
                    </div>
                  </Field>
                  <Field label="Payee / business name" required error={err("name")} hint="Should match the name registered with your bank — payers see the bank's name." className="sm:col-span-2">
                    <Input value={data.name} onChange={(e) => set("name", e.target.value)} onBlur={() => blur("name")} invalid={!!err("name")} placeholder="Sharma General Store" maxLength={99} />
                  </Field>
                </div>

                <div>
                  <span className="label">Amount</span>
                  <Segmented value={amountMode} onChange={setAmountMode} options={[{ value: "open", label: "Customer enters amount" }, { value: "fixed", label: "Fixed amount" }]} />
                  {amountMode === "fixed" ? (
                    <Field error={err("amount")} className="mt-3" hint="Max 2 decimals. The payer's app pre-fills this; some apps let the payer edit it.">
                      <div className="relative">
                        <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input aria-label="Amount in rupees" value={data.amount} inputMode="decimal" onChange={(e) => set("amount", e.target.value)} onBlur={() => blur("amount")} invalid={!!err("amount")} className="pl-9" placeholder="250" />
                      </div>
                    </Field>
                  ) : (
                    <p className="hint mt-2">Best for shop counters — one QR for every bill. The customer types the amount in their app.</p>
                  )}
                  {warnings.map((w) => <Alert key={w} tone="warn" className="mt-3" icon={<AlertTriangle className="h-4 w-4" />}>{w}</Alert>)}
                </div>

                <Field label="Payment note (optional)" error={err("note")} hint="Shown to the payer, e.g. “Order #1024” or “Monthly fees”. Max 80 characters.">
                  <Input value={data.note} onChange={(e) => set("note", e.target.value)} onBlur={() => blur("note")} maxLength={80} />
                </Field>

                <details className="group rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <summary className="cursor-pointer text-sm font-semibold">Merchant display & advanced fields</summary>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Tagline on standee"><Input value={display.tagline} onChange={(e) => setDisplay({ ...display, tagline: e.target.value })} maxLength={60} placeholder="Groceries · Dairy · Snacks" /></Field>
                    <Field label="Contact on standee"><Input value={display.phone} onChange={(e) => setDisplay({ ...display, phone: e.target.value })} maxLength={30} placeholder="+91 98765 43210" /></Field>
                    <Field label="Merchant category code (MCC)" error={err("mc")} hint="Only if your bank/PSP gave you one."><Input value={data.mc} onChange={(e) => set("mc", e.target.value)} onBlur={() => blur("mc")} maxLength={4} /></Field>
                    <Field label="Transaction reference" error={err("tr")} hint="For a unique invoice QR."><Input value={data.tr} onChange={(e) => set("tr", e.target.value)} onBlur={() => blur("tr")} maxLength={35} /></Field>
                  </div>
                </details>
              </div>
            ) : (
              <DesignPanel design={design} onChange={setDesign} compact />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg font-bold">How it works</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">For your customers</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
                <li>Open any UPI app — Google Pay, PhonePe, Paytm, BHIM or a bank app.</li>
                <li>Tap <em>Scan QR</em> and point at the code.</li>
                <li>Check that the payee name matches your shop, enter/confirm the amount.</li>
                <li>Authorise with their own UPI PIN in their app.</li>
              </ol>
            </div>
            <div>
              <p className="text-sm font-semibold">For you (merchant)</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
                <li>Confirm every payment in <strong>your own bank / UPI app or SMS</strong> before handing over goods.</li>
                <li>A customer showing a “success” screen is not proof — screenshots can be faked.</li>
                <li>Test the printed QR with a ₹1 payment from another phone.</li>
                <li>For automatic confirmations use a payment gateway with server-side verification.</li>
              </ul>
            </div>
          </div>
        </Card>

        <Alert tone="warn" icon={<ShieldAlert className="h-4 w-4" />} title="Safety">
          This tool only creates a payment request QR. It never processes payments, never sees whether a payment succeeded and never asks for UPI PINs, OTPs or bank passwords. Remember: you never need to scan a QR or enter a PIN to <strong>receive</strong> money.
        </Alert>
      </div>

      <div className="space-y-4 self-start lg:sticky lg:top-24">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Test preview</h2>
          <QrPreview payload={payload || "upi://pay?pa=example@upi&cu=INR"} design={design} invalid={!ok}
            invalidText={!data.vpa && !data.name ? "Enter your UPI ID and name to generate" : undefined} />
          {parsed && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200"><BadgeCheck className="h-4 w-4" /> What the payer&apos;s app will receive</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500">Pay to</dt><dd className="truncate font-mono">{parsed.pa}</dd>
                <dt className="text-slate-500">Name</dt><dd className="truncate">{parsed.pn}</dd>
                <dt className="text-slate-500">Amount</dt><dd>{parsed.am ? `₹${parsed.am} (pre-filled)` : "Entered by customer"}</dd>
                {parsed.tn && (<><dt className="text-slate-500">Note</dt><dd className="truncate">{parsed.tn}</dd></>)}
              </dl>
              <details className="mt-2"><summary className="cursor-pointer text-[11px] text-slate-500">Raw UPI URI</summary><code className="mt-1 block break-all text-[11px]">{payload}</code></details>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={save} loading={saving}><Save className="h-4 w-4" /> Save</Button>
            <a href={payload || undefined} aria-disabled={!payload} className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold dark:border-slate-700 lg:hidden", !payload && "pointer-events-none opacity-50")}>
              <Smartphone className="h-4 w-4" /> Open in app
            </a>
            <Button variant="outline" className="hidden lg:inline-flex" onClick={() => setPoster(true)} disabled={!ok}><Printer className="h-4 w-4" /> Standee</Button>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500"><Info className="mt-px h-3 w-3 shrink-0" /> “Open in app” launches your installed UPI app on a phone so you can check the details. You still review and approve any payment yourself.</p>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Download</h2>
          <ExportPanel payload={payload} design={design} name={`upi-${data.name || "payment"}`} disabledReason={ok ? undefined : "Enter a valid UPI ID and payee name to download."}
            posterDefaults={standee(data.name, display, data.vpa, amountLabel, data.note)} />
          <Button variant="secondary" className="mt-2 w-full lg:hidden" onClick={() => setPoster(true)} disabled={!ok}><Printer className="h-4 w-4" /> Printable standee</Button>
        </Card>
        <p className="px-2 text-center text-xs text-slate-500">Need many payment QRs (e.g. per counter or invoice)? Use the <Link href="/bulk?type=upi" className="font-semibold text-brand">bulk generator</Link>.</p>
      </div>

      <PosterDialog open={poster} onClose={() => setPoster(false)} payload={payload} design={design} name={`upi-${data.name || "payment"}`}
        defaults={standee(data.name, display, data.vpa, amountLabel, data.note)} />
    </div>
  );
}

function standee(name: string, display: { tagline: string; phone: string }, vpa: string, amount: string, note: string) {
  return {
    headline: "Scan & Pay",
    title: name || "Your shop name",
    subtitle: display.tagline || (note ? note : "Pay with any UPI app"),
    highlight: amount,
    detail: `UPI ID: ${vpa}${display.phone ? `  ·  ${display.phone}` : ""}`,
    footer: "Google Pay · PhonePe · Paytm · BHIM · any UPI app",
    disclaimer: "Check the payee name in your app before paying. Never share your UPI PIN or OTP.",
  };
}
