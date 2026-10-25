"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Barcode, QrCode } from "lucide-react";
import { Segmented } from "@/components/ui";
import { Workbench } from "@/components/qr/workbench";
import { BarcodeGenerator } from "@/components/barcode/barcode-generator";

/** Unified generator: QR Code (existing workbench) | Barcode. */
export function GeneratorTabs({ initial }: { initial: "qr" | "barcode" }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode = (sp.get("mode") as "qr" | "barcode") || initial;
  const editing = !!sp.get("id");
  return (
    <div className="space-y-6">
      {!editing && (
        <Segmented value={mode} onChange={(m) => router.replace(`${pathname}?mode=${m}`, { scroll: false })} options={[
          { value: "qr", label: <span className="flex items-center gap-2 px-2"><QrCode className="h-4 w-4" /> QR Code</span> },
          { value: "barcode", label: <span className="flex items-center gap-2 px-2"><Barcode className="h-4 w-4" /> Barcode</span> },
        ]} />
      )}
      {mode === "barcode" && !editing ? <BarcodeGenerator /> : <Workbench mode="generator" />}
    </div>
  );
}
