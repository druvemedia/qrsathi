import type { Metadata } from "next";
import { Suspense } from "react";
import { QrCode } from "lucide-react";
import { GeneratorTabs } from "@/components/generator-tabs";
import { PageHeader, Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: "QR Code & Barcode Generator",
  description: "Create QR codes (UPI, Wi-Fi, WhatsApp, vCard, menus…) and barcodes (EAN-13, UPC, Code 128, ITF-14, GS1-128, Data Matrix, PDF417…) with live preview and free downloads.",
};

export default function GeneratorPage() {
  return (
    <>
      <PageHeader icon={<QrCode className="h-6 w-6" />} title="Code Generator" description="QR codes and barcodes in one place. Live preview, validation and print-ready downloads. Static codes are free without an account." />
      <Suspense fallback={<Spinner />}>
        <GeneratorTabs initial="qr" />
      </Suspense>
    </>
  );
}
