import type { Metadata } from "next";
import { Band, CtaBand, PageIntro } from "@/components/marketing";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "About", description: "What the product is, who it is for, and the principles it is built on." };

export default async function AboutPage() {
  const { branding: b } = await getSettings();
  return (
    <>
      <PageIntro eyebrow="About" title={`${b.brandName} is a practical toolkit for codes that go on real things.`} lede={b.homeDescription} />
      <Band tone="surface">
        <div className="grid gap-12 md:grid-cols-[1fr_2fr]">
          <h2 className="font-serif text-3xl tracking-tight">Who it&apos;s for</h2>
          <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
            <p>Shop owners who want a UPI QR on the counter and barcodes on the shelf. Restaurants that change their menu more often than they reprint table cards. Creators and teams running campaigns who need to know whether a poster is being scanned.</p>
            <p>The free tools — QR and barcode generators, UPI QR and the scanner — work without an account. An account adds a library, dynamic codes, analytics, products and inventory.</p>
          </div>
        </div>
      </Band>
      <Band>
        <div className="grid gap-12 md:grid-cols-[1fr_2fr]">
          <h2 className="font-serif text-3xl tracking-tight">How we build it</h2>
          <dl className="grid gap-8 sm:grid-cols-2">
            {[
              ["Accuracy first", "Every code is decoded again before you download it, and barcodes are validated against their check-digit rules."],
              ["Plain about payments", "A UPI QR is a payment request, not proof of payment. We never handle your money or ask for PINs."],
              ["Privacy by default", "No raw IP addresses in analytics, and tracking can be switched off per code."],
              ["Clear limits", "Plans list exactly what they include, and the same limits are enforced by the server."],
            ].map(([t, d]) => <div key={t}><dt className="font-medium">{t}</dt><dd className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{d}</dd></div>)}
          </dl>
        </div>
      </Band>
      {(b.companyName || b.contactAddress) && (
        <Band tone="surface">
          <div className="grid gap-12 md:grid-cols-[1fr_2fr]">
            <h2 className="font-serif text-3xl tracking-tight">Company</h2>
            <div className="text-zinc-700 dark:text-zinc-300">
              <p className="font-medium">{b.companyName}</p>
              {b.contactAddress && <p className="mt-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{b.contactAddress}</p>}
            </div>
          </div>
        </Band>
      )}
      <CtaBand title="Questions? We're happy to help." primary={["/contact", "Contact us"]} secondary={["/help", "Read the FAQ"]} />
    </>
  );
}
