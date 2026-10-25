import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneCall, ShieldAlert } from "lucide-react";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Report abuse", description: "Report a malicious, fraudulent or illegal QR code or hosted page." };

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:pt-24">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <div>
          <p className="text-sm font-medium text-rose-600 dark:text-rose-400">Report abuse</p>
          <h1 className="mt-3 animate-page-in font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl">Report a QR code</h1>
          <p className="mt-5 max-w-md text-lg text-zinc-600 dark:text-zinc-400">Found a code made with this service that leads to a scam, phishing page or malware? Tell us and we&apos;ll investigate.</p>
          <div className="mt-10 rounded-3xl bg-rose-50 p-6 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/25">
            <p className="flex items-center gap-2 font-semibold text-rose-900 dark:text-rose-100"><PhoneCall className="h-4 w-4" aria-hidden /> Lost money?</p>
            <p className="mt-2 text-sm text-rose-900/80 dark:text-rose-100/80">Also report it at <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="font-medium underline">cybercrime.gov.in</a> or call <a href="tel:1930" className="font-medium underline">1930</a> as soon as possible.</p>
          </div>
          <p className="mt-6 flex items-start gap-2 text-sm text-zinc-500"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Codes that break our rules are disabled; visitors then see a warning instead of the destination.</p>
        </div>
        <div className="lg:pt-8">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_24px_48px_-24px_rgba(0,0,0,.18)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-8">
            <Suspense><ReportForm /></Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
