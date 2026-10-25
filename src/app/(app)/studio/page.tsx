import type { Metadata } from "next";
import { Suspense } from "react";
import { Palette } from "lucide-react";
import { Workbench } from "@/components/qr/workbench";
import { PageHeader, Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: "QR Design Studio",
  description: "Customise QR codes with colours, gradients, rounded modules, custom eyes, logos, frames, captions and patterns — with a live scan test.",
};

export default function StudioPage() {
  return (
    <>
      <PageHeader icon={<Palette className="h-6 w-6" />} title="QR Customization Studio"
        description="Full control over colours, shapes, logo, frames and text. Every change is test-scanned automatically so your design stays readable." />
      <Suspense fallback={<Spinner />}>
        <Workbench mode="studio" />
      </Suspense>
    </>
  );
}
