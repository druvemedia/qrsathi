import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <LegalPage title="Privacy Policy" updated="25 October 2026">
      <p>{s.companyName} (“we”) operates {s.siteName}. This policy explains what we collect, why, and your choices.</p>

      <h2>1. Without an account</h2>
      <p>Static QR codes are generated in your browser. The content you type, logos you add and images you scan with the QR scanner are processed on your device and are not sent to our servers. We store a draft of your design in your browser&apos;s local storage so it survives a page reload; you can clear it at any time from your browser settings.</p>

      <h2>2. Account data</h2>
      <ul>
        <li>Name, email address and a securely hashed password (bcrypt) — or your Google account ID if you sign in with Google.</li>
        <li>QR projects you save: their content, design, names, campaign labels and settings.</li>
        <li>Files you upload for file QR codes, and a history of downloads you make while signed in.</li>
        <li>Security logs (sign-ins, password changes) used to protect your account.</li>
      </ul>

      <h2>3. Scans of dynamic QR codes and hosted pages</h2>
      <p>When someone scans a dynamic QR code we record: the time, device category, browser and operating-system family, and country if our hosting provider supplies it. <strong>We do not store IP addresses.</strong> To estimate unique visitors we store a one-way hash of the IP address, user agent and date combined with a secret key; it changes daily and cannot be reversed to identify a person. Visitors whose browser sends Do-Not-Track or Global Privacy Control are counted without any of these details, and QR owners may switch detailed analytics off. Link-preview bots are not counted.</p>
      <p>QR owners are responsible for informing people who scan their codes where required by law.</p>

      <h2>4. Payments</h2>
      <p>UPI QR codes generated here only contain payment-request details you enter (UPI ID, name, amount, note). We never process, receive or see UPI payments made with them, and we never ask for or store UPI PINs, OTPs, card numbers or bank passwords. Subscription payments are handled by Razorpay; we store only the payment reference, plan, amount and status.</p>

      <h2>5. Cookies</h2>
      <p>We use one essential, HTTP-only cookie to keep you signed in, and short-lived cookies during Google sign-in. We do not use advertising or third-party tracking cookies.</p>

      <h2>6. Sharing</h2>
      <p>We do not sell personal data. We share data only with service providers needed to run the service (hosting, database, email, payment processor) under confidentiality obligations, or when required by law. Abuse reports may be reviewed by our moderators.</p>

      <h2>7. Retention & your rights</h2>
      <p>We keep account data while your account exists. You can edit your profile, export analytics as CSV, delete individual QR codes and files, or delete your entire account from <em>Account settings</em> — this permanently removes your QR codes, analytics and uploads. You may also contact us at <a href={`mailto:${s.supportEmail}`} className="text-brand underline">{s.supportEmail}</a> to access, correct or erase your data, or to raise a grievance.</p>

      <h2>8. Security</h2>
      <p>Passwords are hashed, sessions are signed and HTTP-only, uploads are type-checked and served with restrictive headers, and administrative actions are logged. No system is perfectly secure; please use a strong, unique password.</p>

      <h2>9. Changes</h2>
      <p>We will post updates here and, for material changes, notify account holders by email.</p>
    </LegalPage>
  );
}
