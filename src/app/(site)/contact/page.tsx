import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp, Flag, Mail, MapPin, Phone } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { mailConfigured } from "@/lib/mail";
import { socialLinks } from "@/lib/branding";
import { BrandIcon } from "@/components/brand-icon";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact", description: "How to reach support, report a malicious QR code, or find answers in the help centre." };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const { branding: b } = await getSettings();
  // The form only appears when messages can actually be delivered.
  const formAvailable = !!b.supportEmail && mailConfigured();
  const direct = [
    b.supportEmail && { icon: Mail, label: "E-mail", value: b.supportEmail, href: `mailto:${b.supportEmail}` },
    b.contactPhone && { icon: Phone, label: "Phone", value: b.contactPhone, href: `tel:${b.contactPhone.replace(/[^\d+]/g, "")}` },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href: string }[];
  const social = socialLinks(b);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:pt-24">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <div>
          <p className="text-sm font-medium text-brand">Contact</p>
          <h1 className="mt-3 animate-page-in font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl">Talk to a person.</h1>
          <p className="mt-5 max-w-md text-lg text-zinc-600 dark:text-zinc-400">Account, billing or product questions — write to us. Many answers are in the help centre.</p>

          {direct.length > 0 && (
            <ul className="mt-10 space-y-3">
              {direct.map((d) => (
                <li key={d.label}>
                  <a href={d.href} className="group flex items-center gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"><d.icon className="h-5 w-5" aria-hidden /></span>
                    <span><span className="block text-xs text-zinc-500">{d.label}</span><span className="font-medium group-hover:text-brand">{d.value}</span></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {b.contactAddress && (
            <p className="mt-6 flex gap-3 text-sm text-zinc-600 dark:text-zinc-400"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden /><span className="whitespace-pre-line">{b.contactAddress}</span></p>
          )}
          {social.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Social media">
              {social.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`${b.brandName} on ${l.label} (opens in a new tab)`}
                    className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 text-zinc-600 transition hover:-translate-y-0.5 hover:text-zinc-950 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-white">
                    <BrandIcon brand={l.id} mono className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-12 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {[
              { href: "/help", icon: CircleHelp, title: "Help centre", text: "Printing, dynamic codes, UPI, barcodes, billing." },
              { href: "/report", icon: Flag, title: "Report abuse", text: "A code made here leads to a scam? Tell us." },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="group flex items-center gap-4 py-4">
                <l.icon className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
                <span className="flex-1"><span className="block font-medium">{l.title}</span><span className="block text-sm text-zinc-500">{l.text}</span></span>
                <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:pt-8">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_48px_-24px_rgba(0,0,0,.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-8">
            {formAvailable ? (
              <>
                <h2 className="font-serif text-2xl">Send a message</h2>
                <p className="mb-6 mt-1 text-sm text-zinc-500">We reply by e-mail.</p>
                <ContactForm />
              </>
            ) : (
              <div className="py-6 text-center">
                <Mail className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden />
                <h2 className="mt-4 font-serif text-2xl">{direct.length ? "Write to us directly" : "Contact details coming soon"}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
                  {direct.length ? "The online form isn't set up on this site yet — use the details on the left." : "Contact details haven't been published yet. The help centre answers most questions."}
                </p>
                {b.supportEmail && <a href={`mailto:${b.supportEmail}`} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"><Mail className="h-4 w-4" aria-hidden /> {b.supportEmail}</a>}
              </div>
            )}
            <p className="mt-6 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800">Please don&apos;t send passwords, OTPs or card details.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
