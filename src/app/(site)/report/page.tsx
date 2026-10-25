import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Report abuse", description: "Report a malicious, fraudulent or illegal QR code or hosted page." };

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Report a QR code</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">Found a QR code made with this service that leads to a scam, phishing page or malware? Tell us and we&apos;ll investigate. If you&apos;ve lost money, also report it at <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" className="text-brand underline">cybercrime.gov.in</a> or call 1930.</p>
      <div className="mt-8"><Suspense><ReportForm /></Suspense></div>
    </div>
  );
}
