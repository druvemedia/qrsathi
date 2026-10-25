import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/marketing";
import { TypeGlyph } from "@/components/brand-icon";
import { mergeDesign, renderQr } from "@/lib/qr-render";
import { renderBarcodeSvg } from "@/lib/barcodes";
import { TEMPLATES } from "@/lib/templates";
import { getType } from "@/lib/qr-types";
import { ToolDirectory } from "./tool-directory";

export const metadata: Metadata = {
  title: "Tools",
  description: "Free QR code generator, barcode generator, UPI payment QR, universal scanner, bulk generator and design studio.",
};

const SHORTCUTS = ["url", "wifi", "whatsapp", "vcard", "instagram", "menu", "maps", "event"];

export default function ToolsPage() {
  const qr = renderQr("https://example.com", mergeDesign({ ...TEMPLATES.find((t) => t.id === "aurora")!.design, frame: "none", margin: 1 }), { idPrefix: "tools-qr" }).svg;
  const ean = renderBarcodeSvg("ean13", "2001234567893", { scale: 2, margin: 4, heightMm: 14 });
  return (
    <>
      <header className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 lg:pt-24">
        <p className="text-sm font-medium text-brand">Tools</p>
        <h1 className="mt-3 max-w-3xl animate-page-in font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl">Pick a tool and start.</h1>
        <p className="mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">Static codes need no sign-up. A free account saves codes and makes them editable.</p>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <ToolDirectory qrPreview={qr} barcodePreview={ean} />
        <section className="mt-16" aria-labelledby="shortcuts">
          <h2 id="shortcuts" className="font-serif text-2xl">Jump straight to a QR type</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {SHORTCUTS.map((id) => {
              const t = getType(id);
              return (
                <li key={id}>
                  <Link href={`/generator?type=${id}`} className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3.5 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-card dark:border-zinc-800 dark:bg-zinc-900">
                    <TypeGlyph brand={t.brand} icon={t.icon} size="sm" className="rounded-full shadow-none ring-0" /> {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <CtaBand title="Need editable codes and scan analytics?" primary={["/signup", "Create a free account"]} secondary={["/features", "See all features"]} />
    </>
  );
}
