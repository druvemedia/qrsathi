import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Terms of Service" };

export default async function TermsPage() {
  const s = await getSettings();
  return (
    <LegalPage title="Terms of Service" updated="25 October 2026">
      <p>By using {s.siteName} (“the Service”), operated by {s.companyName}, you agree to these terms.</p>

      <h2>1. The Service</h2>
      <p>The Service lets you generate QR codes, host simple landing pages, create dynamic short links and view scan statistics. Static QR codes you download are yours to use for any lawful purpose, including commercially.</p>

      <h2>2. Accounts</h2>
      <p>You must provide accurate information and keep your password confidential. You are responsible for activity on your account. You must be old enough to form a binding contract in your country.</p>

      <h2>3. Acceptable use</h2>
      <p>You must not use the Service to:</p>
      <ul>
        <li>phish, defraud or impersonate any person, bank, payment app or government body;</li>
        <li>collect UPI PINs, OTPs, passwords or card details, or request “refunds”/“KYC” payments deceptively;</li>
        <li>distribute malware, unauthorised apps or illegal content, or infringe others&apos; rights;</li>
        <li>send spam, or overload, probe or interfere with the Service.</li>
      </ul>
      <p>We may disable QR codes, hosted pages or accounts that violate these rules, with or without notice. Report abuse via the <Link href="/report" className="text-brand underline">abuse form</Link>.</p>

      <h2>4. Payment QR codes</h2>
      <p>UPI and bank QR codes only encode the details you provide. You are responsible for their accuracy. We are not a payment service, do not hold funds, and cannot confirm, reverse or refund any payment. Always verify received payments in your own bank or UPI app.</p>

      <h2>5. Dynamic QR codes & hosted pages</h2>
      <p>Dynamic codes and hosted pages work only while the Service is operating and your account is in good standing. Plan limits apply. If you downgrade, existing dynamic codes keep working but you cannot create more above your plan&apos;s limits. We aim for high availability but do not guarantee uninterrupted service.</p>

      <h2>6. Paid plans</h2>
      <p>Paid plans are 30-day passes charged in advance via our payment processor. A plan activates only after the processor confirms payment. Except where required by law, fees are non-refundable.</p>

      <h2>7. Your content</h2>
      <p>You keep ownership of content you upload. You grant us a licence to store, display and serve it solely to operate the Service. You confirm you have the rights to everything you upload, including logos.</p>

      <h2>8. Disclaimers & liability</h2>
      <p>The Service is provided “as is”. Always test-scan codes before printing in quantity. To the maximum extent permitted by law, our total liability is limited to the amount you paid us in the 3 months before the claim, and we are not liable for indirect or consequential losses (such as reprinting costs or lost sales).</p>

      <h2>9. Termination</h2>
      <p>You may delete your account at any time. We may suspend or terminate accounts that breach these terms.</p>

      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of India. Contact: <a href={`mailto:${s.supportEmail}`} className="text-brand underline">{s.supportEmail}</a>.</p>
    </LegalPage>
  );
}
