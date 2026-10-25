/** Heuristic checks for decoded QR content. Not a guarantee — a prompt to look twice. */
import { VPA_RE, parseUpiUri, type UpiParams } from "./upi";

export type Risk = "safe" | "caution" | "danger";
export interface SafetyNote {
  level: Risk;
  message: string;
}

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "rb.gy", "shorturl.at", "tiny.cc", "ow.ly", "buff.ly", "rebrand.ly", "s.id", "v.gd", "t.ly"];
const RISKY_TLDS = ["zip", "mov", "xyz", "top", "click", "loan", "work", "gq", "tk", "ml", "cf", "ga", "rest", "cam", "country", "kim", "su"];
const EXEC_EXT = /\.(apk|exe|msi|bat|cmd|scr|jar|dmg|pkg|ps1|vbs|xapk)(\?|#|$)/i;
const BAIT = /(kyc|refund|lottery|prize|reward|cashback|verify|account-?update|unlock|blocked|suspend|free-?gift|claim|electricity-?bill|customs)/i;
const BANK_WORDS = /(sbi|hdfc|icici|axis|kotak|paytm|phonepe|gpay|googlepay|bhim|npci|upi|rbi|incometax)/i;
const OFFICIAL = /(^|\.)(sbi\.co\.in|onlinesbi\.sbi|hdfcbank\.com|icicibank\.com|axisbank\.com|kotak\.com|paytm\.com|phonepe\.com|pay\.google\.com|npci\.org\.in|bhimupi\.org\.in|rbi\.org\.in|incometax\.gov\.in|gov\.in|nic\.in)$/i;

export function overall(notes: SafetyNote[]): Risk {
  if (notes.some((n) => n.level === "danger")) return "danger";
  if (notes.some((n) => n.level === "caution")) return "caution";
  return "safe";
}

export function analyzeUrl(raw: string): { url: URL | null; notes: SafetyNote[] } {
  const notes: SafetyNote[] = [];
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { url: null, notes: [{ level: "danger", message: "This isn't a valid web address." }] };
  }
  if (!/^https?:$/.test(url.protocol)) {
    notes.push({ level: "danger", message: `Uses the “${url.protocol}” scheme, which can run code or open apps. It will not be opened.` });
    return { url, notes };
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol === "http:") notes.push({ level: "caution", message: "Not encrypted (http). Don't enter passwords or payment details here." });
  if (url.username || url.password)
    notes.push({ level: "danger", message: "The link hides its real destination using “@” — a classic phishing trick." });
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) notes.push({ level: "caution", message: "Points to a raw IP address instead of a named website." });
  if (host.split(".").some((p) => p.startsWith("xn--"))) notes.push({ level: "danger", message: "Uses look-alike (punycode) characters that can imitate a real brand." });
  if (SHORTENERS.includes(host)) notes.push({ level: "caution", message: "Shortened link — the final destination is hidden until you open it." });
  const tld = host.split(".").pop() || "";
  if (RISKY_TLDS.includes(tld)) notes.push({ level: "caution", message: `“.${tld}” domains are frequently used for spam and scams.` });
  if (EXEC_EXT.test(url.pathname)) notes.push({ level: "danger", message: "Downloads an app/program file. Fake APKs from QR codes are a common fraud — install apps only from the Play Store/App Store." });
  if (BAIT.test(host + url.pathname)) notes.push({ level: "caution", message: "Contains words often used in scams (KYC, refund, prize, verify…)." });
  if (BANK_WORDS.test(host) && !OFFICIAL.test(host)) notes.push({ level: "caution", message: "Mentions a bank or payment brand but isn't its official domain." });
  if (url.port && !["80", "443"].includes(url.port)) notes.push({ level: "caution", message: `Uses an unusual port (${url.port}).` });
  if (host.split(".").length > 4) notes.push({ level: "caution", message: "Has an unusually long chain of sub-domains." });
  if (raw.length > 300) notes.push({ level: "caution", message: "Very long link — check the domain carefully." });
  return { url, notes };
}

export function analyzeUpi(raw: string): { upi: UpiParams | null; notes: SafetyNote[] } {
  const upi = parseUpiUri(raw);
  const notes: SafetyNote[] = [
    { level: "caution", message: "Only scan a UPI QR to PAY someone. You never need to scan a QR or enter your UPI PIN to receive money." },
  ];
  if (!upi) return { upi, notes: [{ level: "danger", message: "This UPI link is malformed (no payee address)." }] };
  if (!VPA_RE.test(upi.pa)) notes.push({ level: "danger", message: "The payee UPI ID looks invalid." });
  if (!upi.pn) notes.push({ level: "caution", message: "No payee name is included. Check the verified name your app shows before paying." });
  if (upi.am) notes.push({ level: "caution", message: `Requests a fixed amount of ₹${upi.am}. Make sure it matches what you owe.` });
  if (upi.cu && upi.cu !== "INR") notes.push({ level: "danger", message: `Currency is “${upi.cu}”, not INR.` });
  if (upi.tn && BAIT.test(upi.tn)) notes.push({ level: "danger", message: "The payment note mentions refunds/prizes/KYC — a common scam pattern." });
  return { upi, notes };
}
