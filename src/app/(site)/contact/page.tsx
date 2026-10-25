import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp, Flag, Mail, MapPin, Phone } from "lucide-react";
import { Band, PageIntro } from "@/components/marketing";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Contact", description: "How to reach support, report a malicious QR code, or find answers in the help centre." };

export default async function ContactPage() {
  const { branding: b } = await getSettings();
  const hasDirect = !!(b.supportEmail || b.contactPhone || b.contactAddress);
  return (
    <>
      <PageIntro eyebrow="Contact" title="Talk to a person." lede="For account, billing or product questions, write to us. Most answers are also in the help centre." />
      <Band tone="surface">
        <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 md:grid-cols-3">
          <div className="bg-white p-7 dark:bg-zinc-950">
            <h2 className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4 text-brand" aria-hidden /> Support</h2>
            {hasDirect ? (
              <ul className="mt-4 space-y-3 text-sm">
                {b.supportEmail && <li><a className="text-brand hover:underline" href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a></li>}
                {b.contactPhone && <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-zinc-400" aria-hidden /><a className="hover:underline" href={`tel:${b.contactPhone.replace(/[^\d+]/g, "")}`}>{b.contactPhone}</a></li>}
                {b.contactAddress && <li className="flex gap-2 text-zinc-600 dark:text-zinc-400"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden /><span className="whitespace-pre-line">{b.contactAddress}</span></li>}
              </ul>
            ) : <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Contact details haven&apos;t been published yet. Please use the help centre in the meantime.</p>}
            <p className="mt-4 text-xs text-zinc-500">Please don&apos;t send passwords, OTPs or card details.</p>
          </div>
          <div className="bg-white p-7 dark:bg-zinc-950">
            <h2 className="flex items-center gap-2 font-medium"><CircleHelp className="h-4 w-4 text-brand" aria-hidden /> Help centre</h2>
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Printing, dynamic codes, UPI, barcodes, plans and billing.</p>
            <Link href="/help" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">Read the FAQ →</Link>
          </div>
          <div className="bg-white p-7 dark:bg-zinc-950">
            <h2 className="flex items-center gap-2 font-medium"><Flag className="h-4 w-4 text-brand" aria-hidden /> Report abuse</h2>
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Found a code made here that leads to a scam or phishing page? Tell us and we&apos;ll investigate.</p>
            <Link href="/report" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">Report a QR code →</Link>
          </div>
        </div>
      </Band>
    </>
  );
}
