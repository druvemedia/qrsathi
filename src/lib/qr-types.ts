/**
 * Registry of every supported QR content type.
 *
 * Each type declares its form fields (rendered by the generic <TypeForm/>),
 * a zod schema used on both the client and the server, and a `build`
 * function that turns validated data into the exact text encoded in the QR.
 * Isomorphic: no React or DOM imports here.
 */
import { z } from "zod";
import { normalizeUrl, isHttpUrl } from "./utils";
import { AMOUNT_RE, IFSC_RE, UPI_HARD_LIMIT, VPA_RE, bankVpa, buildUpiUri } from "./upi";

export type FieldKind =
  | "text" | "textarea" | "url" | "email" | "tel" | "number" | "select"
  | "checkbox" | "date" | "datetime" | "color" | "list" | "file";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  half?: boolean;
  fields?: FieldDef[]; // for kind "list"
  maxItems?: number;
  /** Only show when another field has a given value. */
  showIf?: { field: string; equals: string | string[] };
  accept?: string; // for kind "file"
}

export type Category = "basic" | "social" | "payment" | "business" | "files";

export interface BuildCtx {
  /** Absolute URL of the hosted landing page, e.g. https://app/p/abc123 */
  hostedUrl: string;
}

export interface QrTypeDef {
  id: string;
  label: string;
  description: string;
  category: Category;
  icon: string; // lucide icon name, resolved in the UI
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  schema: z.ZodType<Record<string, any>>;
  build: (data: any, ctx: BuildCtx) => string;
  /** Payload is an http(s) URL that may be wrapped in a dynamic short link. */
  dynamicCapable?: boolean;
  /** Always a dynamic short link (the "Dynamic URL" type). */
  forceDynamic?: boolean;
  /** Returns true when this data must be served as a hosted landing page. */
  hosted?: (data: any) => boolean;
  /** Suggested built-in centre logo and frame caption. */
  logo?: string;
  caption?: string;
}

// ---------- shared schema pieces ----------
const s = (max = 200) => z.string().trim().max(max, `Maximum ${max} characters`);
const req = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Maximum ${max} characters`);
const url = (label = "URL") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(2000, "URL is too long")
    .transform(normalizeUrl)
    .refine(isHttpUrl, "Enter a valid web address, e.g. https://example.com");
const optUrl = z
  .string()
  .trim()
  .max(2000, "URL is too long")
  .transform((v) => (v ? normalizeUrl(v) : ""))
  .refine((v) => !v || isHttpUrl(v), "Enter a valid web address, e.g. https://example.com");
const phone = (label = "Phone number") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\+?[0-9][0-9 ()-]{5,19}$/, "Enter a valid number with country code, e.g. +91 98765 43210");
const optPhone = z
  .string()
  .trim()
  .refine((v) => !v || /^\+?[0-9][0-9 ()-]{5,19}$/.test(v), "Enter a valid phone number");
const optEmail = z
  .string()
  .trim()
  .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address");
const amount = z
  .string()
  .trim()
  .refine((v) => !v || AMOUNT_RE.test(v), "Use numbers only, up to 2 decimals (e.g. 250 or 99.50)")
  .refine((v) => !v || Number(v) > 0, "Amount must be greater than 0")
  .refine((v) => !v || Number(v) <= UPI_HARD_LIMIT, "Amount exceeds the UPI limit of ₹5,00,000");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4f46e5");

const cleanPhone = (p: string) => {
  const t = p.trim();
  return (t.startsWith("+") ? "+" : "") + t.replace(/[^\d]/g, "");
};
const digitsOnly = (p: string) => p.replace(/[^\d]/g, "");

function handleOrUrl(input: string, base: string, prefix = "") {
  const v = input.trim();
  if (/^https?:\/\//i.test(v) || /\.(com|in|me|be)\//i.test(v)) return normalizeUrl(v);
  return `${base}${prefix}${v.replace(/^@/, "")}`;
}

const vEsc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const wifiEsc = (v: string) => v.replace(/([\\;,:"])/g, "\\$1");
const icsEsc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const icsDate = (v: string) => v.replace(/[-:]/g, "").slice(0, 13) + "00"; // 2026-10-25T10:00 -> 20261025T100000

const deliveryField = (pageLabel: string): FieldDef => ({
  name: "delivery",
  label: "QR opens",
  kind: "select",
  options: [
    { value: "page", label: pageLabel },
    { value: "link", label: "An existing link" },
  ],
});
const isPage = (d: any) => d?.delivery !== "link";

// ---------- type definitions ----------
export const QR_TYPES: QrTypeDef[] = [
  {
    id: "url",
    label: "Website URL",
    description: "Open any web page",
    category: "basic",
    icon: "Globe",
    fields: [{ name: "url", label: "Website URL", kind: "url", placeholder: "https://yourwebsite.com", required: true }],
    defaults: { url: "https://example.com" },
    schema: z.object({ url: url("Website URL") }),
    build: (d) => d.url,
    dynamicCapable: true,
    logo: "link",
    caption: "SCAN ME",
  },
  {
    id: "dynamic",
    label: "Dynamic URL",
    description: "Editable destination + scan analytics",
    category: "basic",
    icon: "RefreshCw",
    fields: [
      {
        name: "url", label: "Destination URL", kind: "url", placeholder: "https://yourwebsite.com/offer", required: true,
        hint: "You can change this later without reprinting the QR code.",
      },
    ],
    defaults: { url: "https://example.com" },
    schema: z.object({ url: url("Destination URL") }),
    build: (d) => d.url,
    dynamicCapable: true,
    forceDynamic: true,
    caption: "SCAN ME",
  },
  {
    id: "text",
    label: "Plain Text",
    description: "Show a message or note",
    category: "basic",
    icon: "Type",
    fields: [{ name: "text", label: "Text", kind: "textarea", placeholder: "Type anything…", required: true }],
    defaults: { text: "Hello from QRSathi!" },
    schema: z.object({ text: req("Text", 2000) }),
    build: (d) => d.text,
  },
  {
    id: "vcard",
    label: "Contact vCard",
    description: "Save a contact in one scan",
    category: "basic",
    icon: "Contact",
    fields: [
      { name: "firstName", label: "First name", kind: "text", required: true, half: true },
      { name: "lastName", label: "Last name", kind: "text", half: true },
      { name: "org", label: "Company", kind: "text", half: true },
      { name: "title", label: "Job title", kind: "text", half: true },
      { name: "mobile", label: "Mobile", kind: "tel", placeholder: "+91 98765 43210", half: true },
      { name: "phone", label: "Work phone", kind: "tel", half: true },
      { name: "email", label: "Email", kind: "email", half: true },
      { name: "website", label: "Website", kind: "url", half: true },
      { name: "street", label: "Street address", kind: "text" },
      { name: "city", label: "City", kind: "text", half: true },
      { name: "state", label: "State", kind: "text", half: true },
      { name: "zip", label: "PIN code", kind: "text", half: true },
      { name: "country", label: "Country", kind: "text", half: true },
      { name: "note", label: "Note", kind: "textarea" },
    ],
    defaults: { firstName: "", lastName: "", org: "", title: "", mobile: "", phone: "", email: "", website: "", street: "", city: "", state: "", zip: "", country: "India", note: "" },
    schema: z.object({
      firstName: req("First name", 60), lastName: s(60), org: s(100), title: s(100),
      mobile: optPhone, phone: optPhone, email: optEmail, website: optUrl,
      street: s(150), city: s(60), state: s(60), zip: s(12), country: s(60), note: s(300),
    }),
    build: (d) => {
      const lines = [
        "BEGIN:VCARD", "VERSION:3.0",
        `N:${vEsc(d.lastName)};${vEsc(d.firstName)};;;`,
        `FN:${vEsc([d.firstName, d.lastName].filter(Boolean).join(" "))}`,
      ];
      if (d.org) lines.push(`ORG:${vEsc(d.org)}`);
      if (d.title) lines.push(`TITLE:${vEsc(d.title)}`);
      if (d.mobile) lines.push(`TEL;TYPE=CELL:${cleanPhone(d.mobile)}`);
      if (d.phone) lines.push(`TEL;TYPE=WORK,VOICE:${cleanPhone(d.phone)}`);
      if (d.email) lines.push(`EMAIL;TYPE=INTERNET:${d.email}`);
      if (d.website) lines.push(`URL:${d.website}`);
      if (d.street || d.city || d.state || d.zip || d.country)
        lines.push(`ADR;TYPE=WORK:;;${vEsc(d.street)};${vEsc(d.city)};${vEsc(d.state)};${vEsc(d.zip)};${vEsc(d.country)}`);
      if (d.note) lines.push(`NOTE:${vEsc(d.note)}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    },
    logo: "user",
    caption: "SAVE CONTACT",
  },
  {
    id: "phone",
    label: "Phone Call",
    description: "Dial a number instantly",
    category: "basic",
    icon: "Phone",
    fields: [{ name: "phone", label: "Phone number", kind: "tel", placeholder: "+91 98765 43210", required: true }],
    defaults: { phone: "" },
    schema: z.object({ phone: phone() }),
    build: (d) => `tel:${cleanPhone(d.phone)}`,
    logo: "phone",
    caption: "CALL US",
  },
  {
    id: "sms",
    label: "SMS",
    description: "Pre-filled text message",
    category: "basic",
    icon: "MessageSquare",
    fields: [
      { name: "phone", label: "Phone number", kind: "tel", placeholder: "+91 98765 43210", required: true },
      { name: "message", label: "Message", kind: "textarea", placeholder: "Hi! I'd like to know more…" },
    ],
    defaults: { phone: "", message: "" },
    schema: z.object({ phone: phone(), message: s(300) }),
    build: (d) => `SMSTO:${cleanPhone(d.phone)}:${d.message}`,
    caption: "TEXT US",
  },
  {
    id: "email",
    label: "Email",
    description: "Compose an email",
    category: "basic",
    icon: "Mail",
    fields: [
      { name: "to", label: "Email address", kind: "email", placeholder: "hello@business.in", required: true },
      { name: "subject", label: "Subject", kind: "text" },
      { name: "body", label: "Message", kind: "textarea" },
    ],
    defaults: { to: "", subject: "", body: "" },
    schema: z.object({ to: z.string().trim().min(1, "Email is required").pipe(z.email("Enter a valid email address")), subject: s(150), body: s(1000) }),
    build: (d) => {
      const q = new URLSearchParams();
      if (d.subject) q.set("subject", d.subject);
      if (d.body) q.set("body", d.body);
      const qs = q.toString().replace(/\+/g, "%20");
      return `mailto:${d.to}${qs ? `?${qs}` : ""}`;
    },
    logo: "mail",
    caption: "EMAIL US",
  },
  {
    id: "wifi",
    label: "Wi-Fi",
    description: "Join a network without typing",
    category: "basic",
    icon: "Wifi",
    fields: [
      { name: "ssid", label: "Network name (SSID)", kind: "text", required: true },
      {
        name: "security", label: "Security", kind: "select", half: true,
        options: [{ value: "WPA", label: "WPA/WPA2/WPA3" }, { value: "WEP", label: "WEP (legacy)" }, { value: "nopass", label: "None (open)" }],
      },
      { name: "hidden", label: "Hidden network", kind: "checkbox", half: true },
      { name: "password", label: "Password", kind: "text", showIf: { field: "security", equals: ["WPA", "WEP"] } },
    ],
    defaults: { ssid: "", password: "", security: "WPA", hidden: false },
    schema: z
      .object({ ssid: req("Network name", 32), password: s(63), security: z.enum(["WPA", "WEP", "nopass"]), hidden: z.boolean() })
      .refine((d) => d.security === "nopass" || d.password.length >= (d.security === "WPA" ? 8 : 5), {
        message: "WPA passwords need at least 8 characters",
        path: ["password"],
      }),
    build: (d) =>
      `WIFI:T:${d.security};S:${wifiEsc(d.ssid)};${d.security !== "nopass" ? `P:${wifiEsc(d.password)};` : ""}${d.hidden ? "H:true;" : ""};`,
    logo: "wifi",
    caption: "FREE WI-FI",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Start a WhatsApp chat",
    category: "social",
    icon: "MessageCircle",
    fields: [
      { name: "phone", label: "WhatsApp number (with country code)", kind: "tel", placeholder: "+91 98765 43210", required: true },
      { name: "message", label: "Pre-filled message", kind: "textarea", placeholder: "Hi! I found you via your QR code." },
    ],
    defaults: { phone: "+91 ", message: "" },
    schema: z.object({
      phone: phone("WhatsApp number").refine((v) => digitsOnly(v).length >= 10, "Include the country code, e.g. +91"),
      message: s(500),
    }),
    build: (d) => `https://wa.me/${digitsOnly(d.phone)}${d.message ? `?text=${encodeURIComponent(d.message)}` : ""}`,
    dynamicCapable: true,
    logo: "whatsapp",
    caption: "CHAT WITH US",
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "Open an Instagram profile",
    category: "social",
    icon: "Camera",
    fields: [{ name: "username", label: "Username or profile URL", kind: "text", placeholder: "@yourbrand", required: true }],
    defaults: { username: "" },
    schema: z.object({
      username: req("Username", 200).refine((v) => /^@?[\w.]{1,30}$/.test(v) || /instagram\.com\//i.test(v), "Enter a valid username or instagram.com link"),
    }),
    build: (d) => handleOrUrl(d.username, "https://instagram.com/"),
    dynamicCapable: true,
    logo: "instagram",
    caption: "FOLLOW US",
  },
  {
    id: "facebook",
    label: "Facebook",
    description: "Profile or page",
    category: "social",
    icon: "ThumbsUp",
    fields: [{ name: "page", label: "Page username or URL", kind: "text", placeholder: "yourbrand or https://facebook.com/yourbrand", required: true }],
    defaults: { page: "" },
    schema: z.object({
      page: req("Page", 300).refine((v) => /^[\w.-]{2,80}$/.test(v) || /(facebook|fb)\.com\//i.test(v), "Enter a page name or facebook.com link"),
    }),
    build: (d) => handleOrUrl(d.page, "https://facebook.com/"),
    dynamicCapable: true,
    logo: "facebook",
    caption: "LIKE US",
  },
  {
    id: "youtube",
    label: "YouTube",
    description: "Channel or video",
    category: "social",
    icon: "CirclePlay",
    fields: [{ name: "target", label: "Channel handle or video/channel URL", kind: "text", placeholder: "@yourchannel or https://youtu.be/…", required: true }],
    defaults: { target: "" },
    schema: z.object({
      target: req("Channel or video", 300).refine((v) => /^@[\w.-]{2,60}$/.test(v) || /(youtube\.com|youtu\.be)\//i.test(v), "Enter an @handle or a youtube.com / youtu.be link"),
    }),
    build: (d) => (d.target.startsWith("@") ? `https://www.youtube.com/${d.target}` : normalizeUrl(d.target)),
    dynamicCapable: true,
    logo: "youtube",
    caption: "SUBSCRIBE",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Profile or company page",
    category: "social",
    icon: "Briefcase",
    fields: [
      { name: "kind", label: "Type", kind: "select", options: [{ value: "in", label: "Personal profile" }, { value: "company", label: "Company page" }], half: true },
      { name: "handle", label: "Profile ID or URL", kind: "text", placeholder: "your-name", required: true },
    ],
    defaults: { kind: "in", handle: "" },
    schema: z.object({
      kind: z.enum(["in", "company"]),
      handle: req("Profile", 300).refine((v) => /^[\w-]{2,100}$/.test(v) || /linkedin\.com\//i.test(v), "Enter a profile ID or linkedin.com link"),
    }),
    build: (d) => (/linkedin\.com\//i.test(d.handle) ? normalizeUrl(d.handle) : `https://www.linkedin.com/${d.kind}/${d.handle}`),
    dynamicCapable: true,
    logo: "linkedin",
    caption: "CONNECT",
  },
  {
    id: "maps",
    label: "Google Maps",
    description: "Navigate to a location",
    category: "business",
    icon: "MapPin",
    fields: [
      { name: "mode", label: "Location by", kind: "select", options: [{ value: "address", label: "Address / place name" }, { value: "coords", label: "Coordinates" }] },
      { name: "query", label: "Address or place", kind: "text", placeholder: "Gateway of India, Mumbai", showIf: { field: "mode", equals: "address" } },
      { name: "lat", label: "Latitude", kind: "text", placeholder: "18.9220", half: true, showIf: { field: "mode", equals: "coords" } },
      { name: "lng", label: "Longitude", kind: "text", placeholder: "72.8347", half: true, showIf: { field: "mode", equals: "coords" } },
    ],
    defaults: { mode: "address", query: "", lat: "", lng: "" },
    schema: z
      .object({ mode: z.enum(["address", "coords"]), query: s(300), lat: s(20), lng: s(20) })
      .superRefine((d, ctx) => {
        if (d.mode === "address" && !d.query) ctx.addIssue({ code: "custom", message: "Address is required", path: ["query"] });
        if (d.mode === "coords") {
          const la = Number(d.lat), lo = Number(d.lng);
          if (!d.lat || !Number.isFinite(la) || la < -90 || la > 90) ctx.addIssue({ code: "custom", message: "Latitude must be between -90 and 90", path: ["lat"] });
          if (!d.lng || !Number.isFinite(lo) || lo < -180 || lo > 180) ctx.addIssue({ code: "custom", message: "Longitude must be between -180 and 180", path: ["lng"] });
        }
      }),
    build: (d) =>
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.mode === "coords" ? `${d.lat},${d.lng}` : d.query)}`,
    dynamicCapable: true,
    logo: "pin",
    caption: "FIND US",
  },
  {
    id: "upi",
    label: "UPI Payment",
    description: "GPay, PhonePe, Paytm, BHIM",
    category: "payment",
    icon: "IndianRupee",
    fields: [
      { name: "vpa", label: "UPI ID (VPA)", kind: "text", placeholder: "yourshop@okaxis", required: true },
      { name: "name", label: "Payee / business name", kind: "text", placeholder: "Sharma General Store", required: true },
      { name: "amount", label: "Amount (₹) — leave empty to let the customer enter it", kind: "text", placeholder: "Optional, e.g. 250" },
      { name: "note", label: "Payment note", kind: "text", placeholder: "Optional, e.g. Order #1024" },
      { name: "mc", label: "Merchant category code (MCC)", kind: "text", placeholder: "Optional, 4 digits", half: true },
      { name: "tr", label: "Transaction reference", kind: "text", placeholder: "Optional", half: true },
    ],
    defaults: { vpa: "", name: "", amount: "", note: "", mc: "", tr: "" },
    schema: z.object({
      vpa: z.string().trim().min(1, "UPI ID is required").regex(VPA_RE, "Enter a valid UPI ID like name@bank"),
      name: req("Payee name", 99),
      amount,
      note: s(80).refine((v) => !/[\u0000-\u001f]/.test(v), "Remove special characters"),
      mc: z.string().trim().refine((v) => !v || /^\d{4}$/.test(v), "MCC must be 4 digits"),
      tr: z.string().trim().refine((v) => !v || /^[\w-]{1,35}$/.test(v), "Letters, numbers, - and _ only (max 35)"),
    }),
    build: (d) => buildUpiUri({ pa: d.vpa, pn: d.name, am: d.amount, tn: d.note, mc: d.mc, tr: d.tr }),
    logo: "rupee",
    caption: "SCAN & PAY",
  },
  {
    id: "bank",
    label: "Bank Payment",
    description: "Account + IFSC via UPI",
    category: "payment",
    icon: "Landmark",
    fields: [
      {
        name: "format", label: "QR format", kind: "select",
        options: [{ value: "upi", label: "UPI (account@IFSC) — opens payment apps" }, { value: "text", label: "Bank details as text (manual transfer)" }],
        hint: "UPI account+IFSC addresses are supported by most Indian UPI apps; some banks may not accept them.",
      },
      { name: "name", label: "Account holder name", kind: "text", required: true },
      { name: "account", label: "Account number", kind: "text", required: true, half: true },
      { name: "ifsc", label: "IFSC code", kind: "text", placeholder: "SBIN0001234", required: true, half: true },
      { name: "bankName", label: "Bank name", kind: "text", showIf: { field: "format", equals: "text" } },
      { name: "amount", label: "Amount (₹, optional)", kind: "text", showIf: { field: "format", equals: "upi" }, half: true },
      { name: "note", label: "Note (optional)", kind: "text", showIf: { field: "format", equals: "upi" }, half: true },
    ],
    defaults: { format: "upi", name: "", account: "", ifsc: "", bankName: "", amount: "", note: "" },
    schema: z.object({
      format: z.enum(["upi", "text"]),
      name: req("Account holder name", 99),
      account: z.string().trim().regex(/^\d{9,18}$/, "Account number must be 9–18 digits"),
      ifsc: z.string().trim().toUpperCase().regex(IFSC_RE, "Enter a valid 11-character IFSC, e.g. SBIN0001234"),
      bankName: s(80),
      amount,
      note: s(80),
    }),
    build: (d) =>
      d.format === "upi"
        ? buildUpiUri({ pa: bankVpa(d.account, d.ifsc), pn: d.name, am: d.amount, tn: d.note })
        : [`Account name: ${d.name}`, `Account no: ${d.account}`, `IFSC: ${d.ifsc}`, d.bankName ? `Bank: ${d.bankName}` : ""].filter(Boolean).join("\n"),
    logo: "bank",
    caption: "PAY HERE",
  },
  {
    id: "product",
    label: "Product",
    description: "Product info page or link",
    category: "business",
    icon: "Package",
    fields: [
      deliveryField("A product page (hosted)"),
      { name: "link", label: "Product URL", kind: "url", showIf: { field: "delivery", equals: "link" } },
      { name: "name", label: "Product name", kind: "text", showIf: { field: "delivery", equals: "page" } },
      { name: "price", label: "Price (₹)", kind: "text", half: true, showIf: { field: "delivery", equals: "page" } },
      { name: "sku", label: "SKU / Model", kind: "text", half: true, showIf: { field: "delivery", equals: "page" } },
      { name: "description", label: "Description", kind: "textarea", showIf: { field: "delivery", equals: "page" } },
      { name: "imageUrl", label: "Image URL", kind: "url", showIf: { field: "delivery", equals: "page" } },
      { name: "buyUrl", label: "Buy / more info URL", kind: "url", showIf: { field: "delivery", equals: "page" } },
    ],
    defaults: { delivery: "page", link: "", name: "", price: "", sku: "", description: "", imageUrl: "", buyUrl: "" },
    schema: z
      .object({ delivery: z.enum(["page", "link"]), link: optUrl, name: s(120), price: s(30), sku: s(60), description: s(2000), imageUrl: optUrl, buyUrl: optUrl })
      .superRefine((d, ctx) => {
        if (d.delivery === "link" && !d.link) ctx.addIssue({ code: "custom", message: "Product URL is required", path: ["link"] });
        if (d.delivery === "page" && !d.name) ctx.addIssue({ code: "custom", message: "Product name is required", path: ["name"] });
      }),
    build: (d, ctx) => (isPage(d) ? ctx.hostedUrl : d.link),
    hosted: isPage,
    dynamicCapable: true,
    caption: "VIEW PRODUCT",
  },
  {
    id: "file",
    label: "PDF / File",
    description: "PDF, image or document link",
    category: "files",
    icon: "FileText",
    fields: [
      { name: "fileKind", label: "File type", kind: "select", options: [{ value: "pdf", label: "PDF" }, { value: "image", label: "Image" }, { value: "document", label: "Document" }], half: true },
      { name: "upload", label: "Upload a file (signed-in users)", kind: "file", accept: ".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt", hint: "Max 10 MB. Or paste a link to a file you host elsewhere (Drive, Dropbox…)." },
      { name: "url", label: "File URL", kind: "url", placeholder: "https://drive.google.com/…", required: true },
    ],
    defaults: { fileKind: "pdf", url: "" },
    schema: z.object({ fileKind: z.enum(["pdf", "image", "document"]), url: url("File URL") }),
    build: (d) => d.url,
    dynamicCapable: true,
    logo: "file",
    caption: "VIEW FILE",
  },
  {
    id: "event",
    label: "Event / Calendar",
    description: "Add an event to calendar",
    category: "files",
    icon: "CalendarDays",
    fields: [
      { name: "title", label: "Event title", kind: "text", required: true },
      { name: "start", label: "Starts", kind: "datetime", required: true, half: true },
      { name: "end", label: "Ends", kind: "datetime", required: true, half: true },
      { name: "location", label: "Location", kind: "text" },
      { name: "description", label: "Description", kind: "textarea" },
    ],
    defaults: { title: "", start: "", end: "", location: "", description: "" },
    schema: z
      .object({ title: req("Event title", 120), start: req("Start time", 20), end: req("End time", 20), location: s(200), description: s(500) })
      .refine((d) => !d.start || !d.end || d.end > d.start, { message: "End must be after start", path: ["end"] }),
    build: (d) =>
      [
        "BEGIN:VEVENT",
        `SUMMARY:${icsEsc(d.title)}`,
        `DTSTART:${icsDate(d.start)}`,
        `DTEND:${icsDate(d.end)}`,
        d.location ? `LOCATION:${icsEsc(d.location)}` : "",
        d.description ? `DESCRIPTION:${icsEsc(d.description)}` : "",
        "END:VEVENT",
      ].filter(Boolean).join("\n"),
    logo: "calendar",
    caption: "SAVE THE DATE",
  },
  {
    id: "app",
    label: "App Download",
    description: "Smart link to App/Play Store",
    category: "business",
    icon: "Smartphone",
    fields: [
      deliveryField("Smart page (detects iPhone/Android)"),
      { name: "appName", label: "App name", kind: "text", showIf: { field: "delivery", equals: "page" } },
      { name: "android", label: "Google Play URL", kind: "url", placeholder: "https://play.google.com/store/apps/details?id=…" },
      { name: "ios", label: "App Store URL", kind: "url", placeholder: "https://apps.apple.com/…", showIf: { field: "delivery", equals: "page" } },
      { name: "fallback", label: "Website (other devices)", kind: "url", showIf: { field: "delivery", equals: "page" } },
    ],
    defaults: { delivery: "page", appName: "", android: "", ios: "", fallback: "" },
    schema: z
      .object({ delivery: z.enum(["page", "link"]), appName: s(80), android: optUrl, ios: optUrl, fallback: optUrl })
      .superRefine((d, ctx) => {
        if (!d.android && !(d.delivery === "page" && (d.ios || d.fallback)))
          ctx.addIssue({ code: "custom", message: "Add at least one store link", path: ["android"] });
      }),
    build: (d, ctx) => (isPage(d) ? ctx.hostedUrl : d.android),
    hosted: isPage,
    dynamicCapable: true,
    logo: "phone",
    caption: "GET THE APP",
  },
  {
    id: "links",
    label: "Multi-link / Link-in-bio",
    description: "One QR, many links",
    category: "social",
    icon: "Link",
    fields: [
      { name: "title", label: "Page title", kind: "text", required: true },
      { name: "bio", label: "Short bio", kind: "textarea" },
      { name: "avatarUrl", label: "Avatar image URL", kind: "url" },
      { name: "color", label: "Accent colour", kind: "color", half: true },
      {
        name: "links", label: "Links", kind: "list", maxItems: 20,
        fields: [
          { name: "label", label: "Label", kind: "text", placeholder: "My website" },
          { name: "url", label: "URL", kind: "url", placeholder: "https://…" },
        ],
      },
    ],
    defaults: { title: "", bio: "", avatarUrl: "", color: "#4f46e5", links: [{ label: "", url: "" }] },
    schema: z.object({
      title: req("Title", 80), bio: s(300), avatarUrl: optUrl, color: hexColor,
      links: z.array(z.object({ label: req("Label", 60), url: url() })).min(1, "Add at least one link").max(20),
    }),
    build: (_d, ctx) => ctx.hostedUrl,
    hosted: () => true,
    logo: "link",
    caption: "ALL MY LINKS",
  },
  {
    id: "menu",
    label: "Restaurant Menu",
    description: "Digital menu page or PDF link",
    category: "business",
    icon: "UtensilsCrossed",
    fields: [
      deliveryField("A digital menu page (hosted)"),
      { name: "link", label: "Menu URL (PDF/website)", kind: "url", showIf: { field: "delivery", equals: "link" } },
      { name: "restaurant", label: "Restaurant name", kind: "text", showIf: { field: "delivery", equals: "page" } },
      { name: "tagline", label: "Tagline", kind: "text", showIf: { field: "delivery", equals: "page" } },
      { name: "color", label: "Accent colour", kind: "color", half: true, showIf: { field: "delivery", equals: "page" } },
      {
        name: "items", label: "Menu items", kind: "list", maxItems: 150, showIf: { field: "delivery", equals: "page" },
        fields: [
          { name: "category", label: "Category", kind: "text", placeholder: "Starters" },
          { name: "name", label: "Dish", kind: "text", placeholder: "Paneer Tikka" },
          { name: "price", label: "Price (₹)", kind: "text", placeholder: "220" },
          { name: "description", label: "Description", kind: "text", placeholder: "Optional" },
        ],
      },
    ],
    defaults: { delivery: "page", link: "", restaurant: "", tagline: "", color: "#ea580c", items: [{ category: "", name: "", price: "", description: "" }] },
    schema: z
      .object({
        delivery: z.enum(["page", "link"]), link: optUrl, restaurant: s(80), tagline: s(120), color: hexColor,
        items: z.array(z.object({ category: s(40), name: s(80), price: s(20), description: s(200) })).max(150),
      })
      .superRefine((d, ctx) => {
        if (d.delivery === "link" && !d.link) ctx.addIssue({ code: "custom", message: "Menu URL is required", path: ["link"] });
        if (d.delivery === "page") {
          if (!d.restaurant) ctx.addIssue({ code: "custom", message: "Restaurant name is required", path: ["restaurant"] });
          if (!d.items.some((i) => i.name)) ctx.addIssue({ code: "custom", message: "Add at least one dish", path: ["items"] });
        }
      }),
    build: (d, ctx) => (isPage(d) ? ctx.hostedUrl : d.link),
    hosted: isPage,
    dynamicCapable: true,
    logo: "menu",
    caption: "VIEW MENU",
  },
  {
    id: "business",
    label: "Business Profile",
    description: "Contact, hours, location",
    category: "business",
    icon: "Building2",
    fields: [
      { name: "name", label: "Business name", kind: "text", required: true },
      { name: "tagline", label: "Tagline", kind: "text" },
      { name: "description", label: "About", kind: "textarea" },
      { name: "logoUrl", label: "Logo image URL", kind: "url" },
      { name: "phone", label: "Phone", kind: "tel", half: true },
      { name: "whatsapp", label: "WhatsApp", kind: "tel", half: true },
      { name: "email", label: "Email", kind: "email", half: true },
      { name: "website", label: "Website", kind: "url", half: true },
      { name: "address", label: "Address", kind: "textarea" },
      { name: "hours", label: "Opening hours", kind: "textarea", placeholder: "Mon–Sat: 10am – 8pm\nSun: Closed" },
      { name: "color", label: "Accent colour", kind: "color", half: true },
    ],
    defaults: { name: "", tagline: "", description: "", logoUrl: "", phone: "", whatsapp: "", email: "", website: "", address: "", hours: "", color: "#0f766e" },
    schema: z.object({
      name: req("Business name", 100), tagline: s(150), description: s(1500), logoUrl: optUrl,
      phone: optPhone, whatsapp: optPhone, email: optEmail, website: optUrl, address: s(300), hours: s(400), color: hexColor,
    }),
    build: (_d, ctx) => ctx.hostedUrl,
    hosted: () => true,
    logo: "store",
    caption: "VISIT US",
  },
  {
    id: "feedback",
    label: "Feedback & Reviews",
    description: "Collect reviews and ratings",
    category: "business",
    icon: "Star",
    fields: [
      deliveryField("A review page (hosted)"),
      { name: "reviewUrl", label: "Review link (e.g. Google review URL)", kind: "url", placeholder: "https://g.page/r/…/review", required: true },
      { name: "business", label: "Business name", kind: "text", showIf: { field: "delivery", equals: "page" } },
      { name: "question", label: "Prompt", kind: "text", placeholder: "How was your experience?", showIf: { field: "delivery", equals: "page" } },
      { name: "feedbackEmail", label: "Private feedback email", kind: "email", hint: "Unhappy customers can email you directly.", showIf: { field: "delivery", equals: "page" } },
    ],
    defaults: { delivery: "page", reviewUrl: "", business: "", question: "How was your experience?", feedbackEmail: "" },
    schema: z
      .object({ delivery: z.enum(["page", "link"]), reviewUrl: url("Review link"), business: s(100), question: s(150), feedbackEmail: optEmail })
      .superRefine((d, ctx) => {
        if (d.delivery === "page" && !d.business) ctx.addIssue({ code: "custom", message: "Business name is required", path: ["business"] });
      }),
    build: (d, ctx) => (isPage(d) ? ctx.hostedUrl : d.reviewUrl),
    hosted: isPage,
    dynamicCapable: true,
    logo: "star",
    caption: "REVIEW US",
  },
  {
    id: "coupon",
    label: "Coupon & Offer",
    description: "Promo code landing page",
    category: "business",
    icon: "TicketPercent",
    fields: [
      { name: "business", label: "Business name", kind: "text", required: true },
      { name: "offer", label: "Offer headline", kind: "text", placeholder: "Flat 20% OFF", required: true },
      { name: "code", label: "Coupon code", kind: "text", placeholder: "DIWALI20", half: true },
      { name: "validUntil", label: "Valid until", kind: "date", half: true },
      { name: "description", label: "Details", kind: "textarea" },
      { name: "terms", label: "Terms & conditions", kind: "textarea" },
      { name: "redeemUrl", label: "Redeem / shop URL", kind: "url" },
      { name: "color", label: "Accent colour", kind: "color", half: true },
    ],
    defaults: { business: "", offer: "", code: "", validUntil: "", description: "", terms: "", redeemUrl: "", color: "#db2777" },
    schema: z.object({
      business: req("Business name", 100), offer: req("Offer", 80), code: s(40), validUntil: s(12),
      description: s(800), terms: s(1500), redeemUrl: optUrl, color: hexColor,
    }),
    build: (_d, ctx) => ctx.hostedUrl,
    hosted: () => true,
    logo: "gift",
    caption: "GET OFFER",
  },
  {
    id: "landing",
    label: "Custom Landing Page",
    description: "Build a simple mobile page",
    category: "business",
    icon: "LayoutTemplate",
    fields: [
      { name: "title", label: "Headline", kind: "text", required: true },
      { name: "subtitle", label: "Sub-headline", kind: "text" },
      { name: "imageUrl", label: "Hero image URL", kind: "url" },
      { name: "body", label: "Content", kind: "textarea", hint: "Plain text. Blank lines start new paragraphs." },
      { name: "ctaLabel", label: "Button label", kind: "text", half: true },
      { name: "ctaUrl", label: "Button URL", kind: "url", half: true },
      { name: "color", label: "Accent colour", kind: "color", half: true },
    ],
    defaults: { title: "", subtitle: "", imageUrl: "", body: "", ctaLabel: "", ctaUrl: "", color: "#7c3aed" },
    schema: z
      .object({ title: req("Headline", 120), subtitle: s(200), imageUrl: optUrl, body: s(5000), ctaLabel: s(40), ctaUrl: optUrl, color: hexColor })
      .refine((d) => !d.ctaLabel || d.ctaUrl, { message: "Add a URL for the button", path: ["ctaUrl"] }),
    build: (_d, ctx) => ctx.hostedUrl,
    hosted: () => true,
    caption: "SCAN ME",
  },
];

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "basic", label: "Essentials" },
  { id: "payment", label: "Payments" },
  { id: "social", label: "Social" },
  { id: "business", label: "Business" },
  { id: "files", label: "Files & Events" },
];

export const TYPE_MAP: Record<string, QrTypeDef> = Object.fromEntries(QR_TYPES.map((t) => [t.id, t]));

export function getType(id: string | null | undefined): QrTypeDef {
  return (id && TYPE_MAP[id]) || TYPE_MAP.url;
}

export function isHostedType(t: QrTypeDef, data: unknown) {
  return !!t.hosted?.(data);
}

export interface ValidationResult {
  ok: boolean;
  data?: Record<string, any>;
  errors: Record<string, string>;
}

/** Validates form data. Error keys are dotted paths, e.g. "links.0.url". */
export function validateContent(t: QrTypeDef, data: unknown): ValidationResult {
  const r = t.schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

export function buildPayload(t: QrTypeDef, data: Record<string, any>, ctx: BuildCtx) {
  return t.build(data, ctx);
}
