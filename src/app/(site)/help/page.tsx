import type { Metadata } from "next";
import Link from "next/link";
import { Flag, Mail } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { HelpCenter, type HelpSection } from "./help-center";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "Answers about UPI QR codes, static vs dynamic QR, scan reliability, printing sizes, barcodes, the scanner, bulk generation, analytics, accounts and billing.",
};

const SECTIONS: HelpSection[] = [
  {
    id: "getting-started", title: "Getting started", icon: "start", blurb: "Accounts, formats, downloads",
    items: [
      { q: "Do I need an account?", k: "sign up free static", a: "No. You can create and download static QR codes of every type without signing up. An account is needed to save codes, create dynamic QR codes or hosted pages, upload files and see analytics." },
      { q: "How do I make a QR code?", k: "create steps generator", a: <>Open the <Link href="/generator">generator</Link>, pick what the code should open, fill in the details, then download. The preview updates as you type and is test-scanned automatically.</> },
      { q: "Are downloads watermarked?", k: "watermark commercial", a: "No. PNG, JPG, SVG and PDF downloads are clean and free for commercial use." },
      { q: "Which format should I download?", k: "svg pdf png jpg print", a: <>Use <strong>SVG</strong> or <strong>PDF</strong> for printing (they stay sharp at any size), <strong>PNG</strong> for websites and WhatsApp, and <strong>JPG</strong> only when a tool doesn&apos;t accept PNG. The 4096 px PNG suits large prints.</> },
    ],
  },
  {
    id: "design", title: "Design & printing", icon: "design", blurb: "Styles, logos, sizes",
    items: [
      { q: "How do I add colours, a logo or a frame?", k: "customise style studio logo frame caption colour", a: <>In the generator, switch to <strong>Style</strong>, or open the <Link href="/studio">design studio</Link>. Adding a logo raises error correction automatically.</> },
      { q: "Will every design scan?", k: "scan reliability decorative", a: "Not necessarily. Low contrast, large logos and busy styles make codes harder to read. The live scan test warns you when our scanner can't read a design — still test the printed code with a few phones." },
      { q: "How big should I print it?", k: "size cm distance poster", a: "At least 2 × 2 cm for close-range scanning. A good rule is 1 cm of QR width per 10 cm of scanning distance — a poster read from 2 m needs about 20 cm." },
      { q: "What is error correction?", k: "ecc damage level", a: "Extra data that lets a damaged or partly covered code still scan. Level M (15%) is a good default; H (30%) is used automatically when you add a logo." },
    ],
  },
  {
    id: "upi", title: "UPI payment QR", icon: "upi", blurb: "Counter codes, safety",
    items: [
      { q: "Which apps can scan my UPI QR?", k: "google pay phonepe paytm bhim", a: "Any app that supports UPI QR scanning — Google Pay, PhonePe, Paytm, BHIM, Amazon Pay and most bank apps. The QR uses the standard upi://pay format." },
      { q: "Fixed or customer-entered amount?", k: "amount fixed open", a: "Leave the amount empty for a counter QR that works for every bill. Set a fixed amount for a specific invoice or product. Some apps let the payer edit a pre-filled amount, and some limit QR payments to personal (non-merchant) UPI IDs." },
      { q: "How do I know a customer paid?", k: "payment proof screenshot confirm", a: <>Only your bank or UPI app (or SMS from your bank) can confirm a payment. A customer&apos;s phone screen is <strong>not</strong> proof — screenshots can be faked. This site never sees payments and never marks anything as paid because a QR was scanned.</> },
      { q: "Can I use a bank account instead of a UPI ID?", k: "ifsc account bank neft", a: "Yes — the Bank Payment type encodes your account number and IFSC as a UPI address (account@IFSC.ifsc.npci), which most UPI apps accept. You can also create a plain-text QR with bank details for manual NEFT/IMPS transfers." },
      { q: "Is it safe?", k: "pin otp fraud scam", a: "We never ask for or store UPI PINs, OTPs or bank passwords. You never need to scan a QR or enter your PIN to receive money — anyone who asks you to is attempting fraud." },
    ],
  },
  {
    id: "dynamic", title: "Static vs dynamic", icon: "dynamic", blurb: "Editable codes, uptime",
    items: [
      { q: "What's the difference?", k: "static dynamic short link edit", a: "A static QR stores the content directly in the image — it works forever and offline, but can't be changed. A dynamic QR stores a short link on this site that redirects to your destination, so you can change it later, pause it and track scans." },
      { q: "What happens if this service goes down?", k: "offline domain outage", a: <>Dynamic QR codes and hosted pages <strong>depend on this service and its domain</strong>. If the server is offline or the domain lapses, printed dynamic codes stop working. Static codes are unaffected. If you self-host, keep <code>NEXT_PUBLIC_APP_URL</code> stable.</> },
      { q: "Can I convert a static QR to dynamic later?", k: "convert change printed", a: "No — a printed static QR can't change. Create a dynamic QR and use that for new prints." },
    ],
  },
  {
    id: "barcodes", title: "Barcodes & scanner", icon: "barcodes", blurb: "Formats, GS1, camera",
    items: [
      { q: "Which barcode should I use?", k: "ean13 upc code128 format choose", a: <>EAN-13 for retail products in most countries, UPC-A for the US and Canada, ITF-14 for cartons, and Code 128 for your own SKUs and asset tags. The <Link href="/barcodes">barcode generator</Link> explains each format.</> },
      { q: "Do I need GS1 numbers?", k: "gs1 gtin retail marketplace", a: "Products sold through retailers and marketplaces need GTINs allocated to your company by GS1. Internal numbers generated here use the restricted-circulation prefix 2 and are only for use inside your own shop or warehouse." },
      { q: "The camera doesn't start", k: "camera permission https blocked", a: "Allow camera access for this site in your browser (the camera icon in the address bar) and try again. Browsers only allow the camera on HTTPS. You can always upload or paste an image instead." },
      { q: "Is camera video uploaded?", k: "privacy camera video device", a: "No. Decoding runs on your device; camera frames and images are never uploaded. Nothing opens automatically, and scanning never changes stock." },
    ],
  },
  {
    id: "privacy", title: "Analytics & privacy", icon: "privacy", blurb: "What's tracked",
    items: [
      { q: "What do you track when someone scans?", k: "track device country ip", a: "For dynamic QR codes: time of scan, device type, browser, operating system and (when the hosting platform provides it) country. Raw IP addresses are never stored — a salted, daily-rotating hash estimates unique visitors." },
      { q: "Do you respect Do-Not-Track?", k: "dnt gpc privacy", a: "Yes. Visitors sending Do-Not-Track or Global Privacy Control are counted, but no device details or visitor hash are stored. Owners can also turn detailed analytics off per QR code." },
      { q: "Are scans the same as sales or payments?", k: "scans sales conversions", a: "No. A scan means someone opened the link. It doesn't mean they bought something or paid." },
    ],
  },
  {
    id: "account", title: "Account & security", icon: "account", blurb: "Password, devices, deletion",
    items: [
      { q: "I forgot my password", k: "reset password forgot", a: <>Use <Link href="/forgot-password">Forgot password</Link> on the sign-in page. A reset link is sent to your e-mail address.</> },
      { q: "How do I sign out other devices?", k: "sessions devices sign out", a: <>Settings → Account &amp; security → <strong>Sign out other devices</strong>. Changing your password also signs out other sessions.</> },
      { q: "How do I delete my account?", k: "delete close remove data", a: "Settings → Delete account. Your codes, products and files are removed, and dynamic QR codes stop working." },
    ],
  },
  {
    id: "billing", title: "Plans & billing", icon: "billing", blurb: "Upgrades, cancelling",
    items: [
      { q: "How does billing work?", k: "razorpay subscription renew", a: "Paid plans are subscriptions processed by Razorpay and renew monthly or yearly until you cancel. Card and UPI details are entered on Razorpay's checkout, never on this site." },
      { q: "When does my plan change?", k: "upgrade activate confirm", a: "Only after Razorpay confirms the payment to our server. If you close the payment window early or the payment is still processing, your plan stays the same until the confirmation arrives." },
      { q: "How do I cancel?", k: "cancel subscription", a: "Settings → Billing → Cancel subscription. You keep the plan until the end of the period you've paid for; Razorpay won't charge you again." },
      { q: "What happens to my codes if I downgrade?", k: "downgrade limits", a: "Nothing is deleted. Dynamic QR codes keep redirecting; you just can't create more than the new plan allows until you're under its limits." },
    ],
  },
  {
    id: "troubleshooting", title: "Troubleshooting", icon: "trouble", blurb: "When something's off",
    items: [
      { q: "Why won't my QR scan?", k: "not scanning contrast quiet zone", a: "Common causes: low contrast (light modules or a dark background), a logo that's too large, a missing quiet zone (the empty border), printing too small, or a glossy or curved surface. Fix the warning the editor shows, then re-test." },
      { q: "My dynamic code shows “paused” or “not found”", k: "paused disabled not found", a: <>Paused codes can be re-enabled from <Link href="/dynamic">Dynamic QR</Link>. A deleted code can&apos;t be restored. Codes disabled after an abuse report can&apos;t be re-enabled by the owner — contact support.</> },
      { q: "I hit a plan limit", k: "limit quota full", a: <>Delete codes you no longer need, or compare plans on the <Link href="/pricing">pricing page</Link>.</> },
    ],
  },
];

export default async function HelpPage() {
  const s = await getSettings();
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]" aria-hidden style={{ background: "radial-gradient(50% 60% at 50% 0%, hsl(var(--brand) / .10), transparent 70%)" }} />
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
        <header className="mx-auto mb-10 max-w-2xl animate-page-in text-center">
          <p className="text-sm font-medium text-brand">Help centre</p>
          <h1 className="mt-3 font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl">How can we help?</h1>
        </header>
        <HelpCenter sections={SECTIONS} />

        <section className="mt-20 grid gap-4 md:grid-cols-2" aria-label="More help">
          <Link href="/contact" className="group flex items-center gap-4 rounded-3xl bg-zinc-950 p-6 text-white transition hover:-translate-y-0.5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Mail className="h-5 w-5" aria-hidden /></span>
            <span><span className="block font-semibold">Still stuck?</span><span className="block text-sm text-white/60">{s.supportEmail ? `Contact support — ${s.supportEmail}` : "See the contact page"}</span></span>
          </Link>
          <Link href="/report" className="group flex items-center gap-4 rounded-3xl border border-zinc-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-card dark:border-zinc-800 dark:bg-zinc-900">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10"><Flag className="h-5 w-5" aria-hidden /></span>
            <span><span className="block font-semibold">Report a malicious QR code</span><span className="block text-sm text-zinc-500">Scam or phishing page made here? Tell us.</span></span>
          </Link>
        </section>
      </div>
    </div>
  );
}
