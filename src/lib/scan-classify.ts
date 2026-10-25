/** Classifies decoded QR/barcode content for the smart scanner. Isomorphic. */
import { isValidGs1, parseGs1 } from "./barcodes";

export type ScanKind =
  | "url" | "upi" | "wifi" | "vcard" | "event" | "tel" | "sms" | "email" | "geo"
  | "product" | "isbn" | "issn" | "gs1" | "logistics" | "text" | "binary";

export const KIND_LABELS: Record<ScanKind, string> = {
  url: "Website link", upi: "UPI payment request", wifi: "Wi-Fi network", vcard: "Contact card", event: "Calendar event",
  tel: "Phone number", sms: "SMS", email: "Email", geo: "Location", product: "Product barcode", isbn: "Book (ISBN)",
  issn: "Periodical (ISSN)", gs1: "GS1 product data", logistics: "Shipping / logistics code", text: "Text", binary: "Binary / unknown data",
};

const RETAIL = new Set(["EAN13", "EAN8", "UPCA", "UPCE", "ISBN"]);

export function classifyScan(text: string, format?: string, contentType?: string): ScanKind {
  const t = text.trim();
  if (contentType === "Binary") return "binary";
  const gs1 = parseGs1(t);
  if (gs1 || contentType === "GS1") return gs1?.some((p) => p.ai === "00") ? "logistics" : "gs1";
  if (format === "ITF14" || (format === "ITF" && /^\d{14}$/.test(t) && isValidGs1(t))) return "logistics";
  if ((format === "EAN13" || format === "ISBN" || !format) && /^97[89]\d{10}$/.test(t) && isValidGs1(t)) return "isbn";
  if ((format === "EAN13" || !format) && /^977\d{10}$/.test(t) && isValidGs1(t)) return "issn";
  if (format && RETAIL.has(format)) return "product";
  if (!format && /^(\d{8}|\d{12,13})$/.test(t) && isValidGs1(t)) return "product";
  if (/^upi:\/\//i.test(t)) return "upi";
  if (/^https?:\/\//i.test(t)) return "url";
  if (/^WIFI:/i.test(t)) return "wifi";
  if (/^BEGIN:VCARD/i.test(t) || /^MECARD:/i.test(t)) return "vcard";
  if (/^BEGIN:(VEVENT|VCALENDAR)/i.test(t)) return "event";
  if (/^tel:/i.test(t)) return "tel";
  if (/^(sms|smsto):/i.test(t)) return "sms";
  if (/^mailto:/i.test(t) || /^MATMSG:/i.test(t)) return "email";
  if (/^geo:/i.test(t)) return "geo";
  return "text";
}

/** ISBN-13 → hyphen-free ISBN-10 where possible (978 prefix only). */
export function isbn13to10(isbn13: string) {
  if (!/^978\d{10}$/.test(isbn13)) return null;
  const body = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * (10 - i);
  const c = (11 - (sum % 11)) % 11;
  return body + (c === 10 ? "X" : String(c));
}

/** ISSN from a 977 EAN-13. */
export function issnFromEan(ean: string) {
  if (!/^977\d{10}$/.test(ean)) return null;
  const seven = ean.slice(3, 10);
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(seven[i]) * (8 - i);
  const c = (11 - (sum % 11)) % 11;
  const issn = seven + (c === 10 ? "X" : String(c));
  return `${issn.slice(0, 4)}-${issn.slice(4)}`;
}
