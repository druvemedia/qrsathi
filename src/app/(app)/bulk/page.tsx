import type { Metadata } from "next";
import { Suspense } from "react";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui";
import { BulkModes } from "./bulk-modes";

export const metadata: Metadata = {
  title: "Bulk QR Code & Barcode Generator — CSV & Excel",
  description: "Generate hundreds of QR codes from a CSV or Excel file: URLs, UPI payment QR, vCards, Wi-Fi and more. Column mapping, validation and ZIP export.",
};

export default function BulkPage() {
  return (
    <>
      <PageHeader icon={<FileSpreadsheet className="h-6 w-6" />} title="Bulk Generator"
        description="Upload a spreadsheet, map its columns and check every row, then download QR codes, barcodes or product labels as a ZIP or printable PDF. Files are processed in your browser." />
      <Suspense fallback={<Spinner />}>
        <BulkModes />
      </Suspense>
    </>
  );
}
