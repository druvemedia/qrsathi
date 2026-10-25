import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Barcode, FileSpreadsheet, IndianRupee, Palette, QrCode, ScanLine } from "lucide-react";
import { Band, CtaBand, PageIntro } from "@/components/marketing";
import { renderQr } from "@/lib/qr-render";
import { renderBarcodeSvg } from "@/lib/barcodes";
import { TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Tools",
  description: "Free QR code generator, barcode generator, UPI payment QR, universal scanner, bulk generator and design studio.",
};

export default function ToolsPage() {
  const qr = renderQr("https://example.com", { ...TEMPLATES.find((t) => t.id === "classic")!.design, margin: 1 }, { idPrefix: "tools-qr" }).svg;
  const ean = renderBarcodeSvg("ean13", "2001234567893", { scale: 2, margin: 4, heightMm: 14 });
  const tools = [
    { href: "/generator", icon: QrCode, title: "QR code generator", text: "Pick a content type, fill in the form and download. Static codes need no account.", free: true, preview: qr, square: true },
    { href: "/barcodes", icon: Barcode, title: "Barcode generator", text: "Retail and logistics barcodes with check-digit validation, sizes in millimetres and printable labels.", free: true, preview: ean, square: false },
    { href: "/scanner", icon: ScanLine, title: "Universal scanner", text: "Read QR codes and barcodes with your camera or from an image. Decoding happens on your device.", free: true },
    { href: "/upi", icon: IndianRupee, title: "UPI payment QR", text: "A UPI QR for your counter, with a printable standee. Works with every UPI app.", free: true },
    { href: "/bulk", icon: FileSpreadsheet, title: "Bulk generator", text: "Hundreds of codes from one spreadsheet. Row limits depend on your plan.", free: false },
    { href: "/studio", icon: Palette, title: "Design studio", text: "Brand your codes with colours, shapes, logos and frames; every design is test-scanned.", free: true },
  ];
  return (
    <>
      <PageIntro eyebrow="Tools" title="Free tools you can use right now." lede="No sign-up for static codes. Create an account to save codes, make them dynamic and track scans." />
      <Band tone="surface">
        <ul className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <li key={t.href} className="bg-white dark:bg-zinc-950">
              <Link href={t.href} className="group flex h-full flex-col p-7 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900">
                {t.preview && (
                  <div className="mb-6 flex h-32 items-center justify-center rounded-lg bg-zinc-50 dark:bg-white">
                    <div className={t.square ? "h-24 w-24 [&>svg]:h-full [&>svg]:w-full" : "w-44 [&>svg]:h-auto [&>svg]:w-full"} role="img" aria-label={`${t.title} sample`} dangerouslySetInnerHTML={{ __html: t.preview }} />
                  </div>
                )}
                <h2 className="flex items-center gap-2 font-medium"><t.icon className="h-4 w-4 text-brand" aria-hidden /> {t.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t.text}</p>
                <p className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{t.free ? "Free" : "Free with limits"}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-brand">Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Band>
      <CtaBand title="Need editable codes and scan analytics?" primary={["/signup", "Create a free account"]} secondary={["/features", "See all features"]} />
    </>
  );
}
