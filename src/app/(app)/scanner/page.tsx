import type { Metadata } from "next";
import { Suspense } from "react";
import { ScanLine } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui";
import { Scanner } from "./scanner";

export const metadata: Metadata = {
  title: "Universal QR & Barcode Scanner",
  description: "Scan QR codes and barcodes (EAN, UPC, Code 128, Code 39, ITF, Data Matrix, PDF417, Aztec…) with your camera or from images. Safe-link and UPI warnings, product lookup.",
};

export default function ScannerPage() {
  return (
    <>
      <PageHeader icon={<ScanLine className="h-6 w-6" />} title="Universal Scanner"
        description="Scan QR codes and 1D/2D barcodes with your camera or from images. See the content first — nothing opens automatically, and scans never change stock." />
      <Suspense fallback={<Spinner />}>
        <Scanner />
      </Suspense>
    </>
  );
}
