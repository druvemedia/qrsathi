"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Barcode, QrCode } from "lucide-react";
import { Segmented } from "@/components/ui";
import { BulkTool } from "./bulk-tool";
import { BarcodeBulk } from "./barcode-bulk";

export function BulkModes() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode = sp.get("mode") === "barcode" ? "barcode" : "qr";
  return (
    <div className="space-y-6">
      <Segmented value={mode} onChange={(m) => router.replace(`${pathname}?mode=${m}`, { scroll: false })} options={[
        { value: "qr", label: <span className="flex items-center gap-2 px-2"><QrCode className="h-4 w-4" /> QR codes</span> },
        { value: "barcode", label: <span className="flex items-center gap-2 px-2"><Barcode className="h-4 w-4" /> Barcodes & labels</span> },
      ]} />
      {mode === "barcode" ? <BarcodeBulk /> : <BulkTool />}
    </div>
  );
}
