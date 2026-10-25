import type { Metadata } from "next";
import { History } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { HistoryView } from "./history-view";

export const metadata: Metadata = { title: "Scan history", robots: { index: false } };

export default function ScanHistoryPage() {
  return (
    <>
      <PageHeader icon={<History className="h-6 w-6" />} title="Scan history" description="Every QR code and barcode scanned on this device, with time, format and type." />
      <HistoryView />
    </>
  );
}
