import type { Metadata } from "next";
import { Suspense } from "react";
import { Barcode } from "lucide-react";
import { GeneratorTabs } from "@/components/generator-tabs";
import { PageHeader, Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: "Barcode Generator — EAN, UPC, Code 128, GS1",
  description: "Free barcode generator: EAN-13, EAN-8, UPC-A/E, ISBN, Code 128, Code 39, ITF-14, GS1-128, Data Matrix, PDF417, Aztec. Check-digit validation, labels and printing.",
};

export default function BarcodesPage() {
  return (
    <>
      <PageHeader icon={<Barcode className="h-6 w-6" />} title="Barcode Generator" description="Pick a symbology, enter the data and get a validated, print-ready barcode or label." />
      <Suspense fallback={<Spinner />}>
        <GeneratorTabs initial="barcode" />
      </Suspense>
    </>
  );
}
