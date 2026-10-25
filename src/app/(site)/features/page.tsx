import type { Metadata } from "next";
import {
  Archive, BarChart3, Barcode, BellRing, CalendarClock, FileSpreadsheet, Fingerprint, Globe, History, IndianRupee, KeyRound, Layers, Link2, LockKeyhole,
  Package, Palette, Printer, QrCode, RefreshCw, ScanLine, ShieldCheck, Tags, Wifi,
} from "lucide-react";
import { Band, CtaBand, FeatureGrid, PageIntro, SectionTitle } from "@/components/marketing";
import { QR_TYPES } from "@/lib/qr-types";

export const metadata: Metadata = {
  title: "Features",
  description: "QR codes, UPI payment QR, dynamic codes with analytics, barcodes, a universal scanner, products and inventory, and bulk generation.",
};

export default function FeaturesPage() {
  return (
    <>
      <PageIntro eyebrow="Features" title="Everything you need to make, print and manage codes." lede="A complete list of what the app does today — no roadmap items, no promises." />

      <Band tone="surface" id="create">
        <SectionTitle title="Create" lede="Make codes that scan reliably, in the format your printer or website needs." />
        <FeatureGrid items={[
          { icon: QrCode, title: `${QR_TYPES.length} QR content types`, text: "Links, text, e-mail, SMS, phone, Wi-Fi, WhatsApp, contact cards, locations, events, social profiles, app links and hosted pages.", href: "/generator" },
          { icon: IndianRupee, title: "UPI payment QR", text: "upi://pay codes with payee name, optional fixed amount and note, plus A4/A5 counter standees.", href: "/upi" },
          { icon: Barcode, title: "21 barcode symbologies", text: "EAN, UPC, ISBN, ISSN, Code 128, GS1-128, Code 39/93, ITF-14, Codabar, Data Matrix, PDF417, Aztec and more.", href: "/barcodes" },
          { icon: Palette, title: "Design studio", text: "Colours and gradients, module and eye shapes, logos with automatic error correction, frames and captions.", href: "/studio" },
          { icon: Printer, title: "Print-ready exports", text: "PNG, JPG and SVG up to 4096 px, 300 DPI PDFs, sticker sheets and labels with product name, price and SKU." },
          { icon: FileSpreadsheet, title: "Bulk generation", text: "CSV or Excel in, validated row by row, ZIP or print sheet out — for QR codes and barcodes.", href: "/bulk" },
        ]} />
      </Band>

      <Band id="manage">
        <SectionTitle title="Manage" lede="Keep printed codes useful long after they leave the printer." />
        <FeatureGrid items={[
          { icon: RefreshCw, title: "Dynamic QR codes", text: "A short link you can point somewhere else at any time, pause or retire — the printed code stays the same.", href: "/dynamic" },
          { icon: Layers, title: "Hosted pages", text: "Menus, link-in-bio, business profiles, coupons and feedback pages served from your dynamic code." },
          { icon: CalendarClock, title: "Expiry & aliases", text: "Set an end date or a memorable short-link alias on plans that include them." },
          { icon: BarChart3, title: "Scan analytics", text: "Scans over time, devices, browsers and countries, with CSV export where your plan includes it.", href: "/analytics" },
          { icon: Link2, title: "Campaign tags", text: "UTM parameters added to the destination so scans show up correctly in your web analytics." },
          { icon: Archive, title: "Library", text: "Every saved code with search, favourites, duplicates and a download history." },
        ]} />
      </Band>

      <Band tone="surface" id="business">
        <SectionTitle title="Run the shop" lede="Products, barcodes and stock in one place." />
        <FeatureGrid items={[
          { icon: Package, title: "Products", text: "SKUs, brand, category, variant, price, batch and expiry, with up to ten barcodes per product.", href: "/products" },
          { icon: Tags, title: "Internal GTINs", text: "Numbers in the GS1 restricted-circulation range for in-store use. Retail GTINs must come from GS1 — we never claim to issue them." },
          { icon: History, title: "Stock movements", text: "Stock in, stock out and stock-takes, each recorded with the balance after the change.", href: "/inventory" },
          { icon: BellRing, title: "Low-stock levels", text: "A per-product threshold that flags items to reorder on the inventory dashboard." },
          { icon: ScanLine, title: "Scan to find", text: "The scanner looks up your own products by barcode — UPC-A and EAN-13 forms match the same item.", href: "/scanner" },
          { icon: Wifi, title: "Import & export", text: "Bring a catalogue in from CSV or Excel; duplicates and invalid barcodes are reported per row." },
        ]} />
      </Band>

      <Band id="trust">
        <SectionTitle title="Privacy & security" lede="The defaults we'd want for our own shop." />
        <FeatureGrid items={[
          { icon: Fingerprint, title: "No raw IP addresses", text: "Unique visitors are estimated with a salted daily hash. Do-Not-Track and Global Privacy Control are honoured." },
          { icon: ShieldCheck, title: "Scam warnings", text: "The scanner flags suspicious links and UPI requests before you open them, and never treats a scan as a payment." },
          { icon: LockKeyhole, title: "Account security", text: "Hashed passwords, server-side sessions you can sign out everywhere, and rate-limited sign-in." },
          { icon: KeyRound, title: "Payments via Razorpay", text: "Card and UPI details are entered on Razorpay, never on this site. Plans change only after Razorpay confirms payment." },
          { icon: Globe, title: "Works offline", text: "Static QR codes and barcodes contain their content and keep working even without this service." },
        ]} cols={3} />
      </Band>

      <CtaBand title="Start with a free account — upgrade only if you need more." primary={["/signup", "Create a free account"]} secondary={["/pricing", "See pricing"]} />
    </>
  );
}
