import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "Answers about UPI QR codes, static vs dynamic QR, scan reliability, printing sizes, bulk generation, analytics and privacy.",
};

const FAQ: { section: string; items: [string, React.ReactNode][] }[] = [
  {
    section: "Getting started",
    items: [
      ["Do I need an account?", "No. You can create and download static QR codes of every type without signing up. An account is needed to save codes, create dynamic QR codes or hosted pages, upload files and see analytics."],
      ["Are downloads watermarked?", "No. PNG, JPG, SVG and PDF downloads are clean and free for commercial use."],
      ["Which format should I download?", <>Use <strong>SVG</strong> or <strong>PDF</strong> for printing (they stay sharp at any size), <strong>PNG</strong> for websites and WhatsApp, and <strong>JPG</strong> only when a tool doesn&apos;t accept PNG. The 4096 px PNG is suitable for large prints.</>],
    ],
  },
  {
    section: "UPI payment QR",
    items: [
      ["Which apps can scan my UPI QR?", "Any app that supports UPI QR scanning — Google Pay, PhonePe, Paytm, BHIM, Amazon Pay and most bank apps. The QR uses the standard upi://pay format."],
      ["Fixed or customer-entered amount?", "Leave the amount empty for a counter QR that works for every bill. Set a fixed amount for a specific invoice or product. Some apps may let the payer edit a pre-filled amount, and some limit QR payments to personal (non-merchant) UPI IDs."],
      ["How do I know a customer paid?", <>Only your bank or UPI app (or SMS from your bank) can confirm a payment. A customer&apos;s phone screen is <strong>not</strong> proof — screenshots can be faked. This site never sees payments and never marks anything as paid because a QR was scanned.</>],
      ["Can I use a bank account instead of a UPI ID?", "Yes — the Bank Payment type encodes your account number and IFSC as a UPI address (account@IFSC.ifsc.npci), which most UPI apps accept. You can also create a plain-text QR with bank details for manual NEFT/IMPS transfers."],
      ["Is it safe?", "We never ask for or store UPI PINs, OTPs or bank passwords. Remember: you never need to scan a QR or enter your PIN to receive money — anyone who asks you to is attempting fraud."],
    ],
  },
  {
    section: "Static vs dynamic",
    items: [
      ["What's the difference?", "A static QR stores the content directly in the image — it works forever and offline, but can't be changed. A dynamic QR stores a short link on this site that redirects to your destination, so you can change it later, pause it and track scans."],
      ["What happens if this service goes down?", <>Dynamic QR codes and hosted pages <strong>depend on this service and its domain</strong>. If the server is offline or the domain lapses, printed dynamic codes stop working. Static codes are unaffected. If you self-host, keep <code>NEXT_PUBLIC_APP_URL</code> stable.</>],
      ["Can I convert a static QR to dynamic later?", "No — a printed static QR can't change. Create a dynamic QR and use that for new prints."],
    ],
  },
  {
    section: "Scanning & printing",
    items: [
      ["Why won't my QR scan?", "Common causes: low contrast (light modules or dark backgrounds), a logo that's too large, a missing quiet zone (the empty border), printing too small, or a glossy/curved surface. The live scan test in the editor flags most of these before you download."],
      ["How big should I print it?", "At least 2 × 2 cm for close-range scanning. A good rule is 1 cm of QR width per 10 cm of scanning distance — a poster read from 2 m needs ~20 cm."],
      ["What is error correction?", "Extra data that lets a damaged or partly covered code still scan. Level M (15%) is a good default; H (30%) is used automatically when you add a logo."],
    ],
  },
  {
    section: "Analytics & privacy",
    items: [
      ["What do you track when someone scans?", "For dynamic QR codes: time of scan, device type, browser, operating system and (when the hosting platform provides it) country. Raw IP addresses are never stored — a salted, daily-rotating hash estimates unique visitors."],
      ["Do you respect Do-Not-Track?", "Yes. Visitors sending Do-Not-Track or Global Privacy Control are counted, but no device details or visitor hash are stored. Owners can also turn detailed analytics off per QR code."],
      ["Are scans the same as sales or payments?", "No. A scan means someone opened the link. It doesn't mean they bought something or paid. Analytics clearly separate scans from verified transactions."],
    ],
  },
  {
    section: "Plans & billing",
    items: [
      ["How does billing work?", "Paid plans are subscriptions processed by Razorpay and renew monthly or yearly until you cancel. Card and UPI details are entered on Razorpay's checkout, never on this site."],
      ["When does my plan change?", "Only after Razorpay confirms the payment to our server. If you close the payment window early or the payment is still processing, your plan stays the same until the confirmation arrives."],
      ["How do I cancel?", "Settings → Billing → Cancel subscription. You keep the plan until the end of the period you've paid for; Razorpay won't charge you again."],
      ["What happens to my codes if I downgrade?", "Nothing is deleted. Dynamic QR codes keep redirecting; you just can't create more than the Free plan allows until you're under its limits."],
    ],
  },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default async function HelpPage() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:pt-24">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-brand">Help</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">Answers to common questions.</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Can&apos;t find what you need? {s.supportEmail ? <>Write to <a href={`mailto:${s.supportEmail}`} className="text-brand hover:underline">{s.supportEmail}</a>.</> : <>See the <Link href="/contact" className="text-brand hover:underline">contact page</Link>.</>} To report a malicious QR code, use the <Link href="/report" className="text-brand hover:underline">abuse form</Link>.
        </p>
      </header>
      <div className="mt-14 grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Help topics" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {FAQ.map((g) => <li key={g.section}><a href={`#${slug(g.section)}`} className="block rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-white hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white">{g.section}</a></li>)}
          </ul>
        </nav>
        <div className="space-y-12">
          {FAQ.map((g) => (
            <section key={g.section} id={slug(g.section)} className="scroll-mt-24">
              <h2 className="font-serif text-2xl tracking-tight">{g.section}</h2>
              <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {g.items.map(([q, a]) => (
                  <details key={q} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:hidden">
                      {q}<span className="text-lg leading-none text-zinc-400 transition-transform duration-200 group-open:rotate-45" aria-hidden>+</span>
                    </summary>
                    <div className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{a}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
