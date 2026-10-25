import type { Metadata } from "next";
import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { QrCodesView } from "./qr-codes-view";

export const metadata: Metadata = { title: "QR codes" };

export default async function AdminQrCodesPage() {
  await requirePageAdmin("/admin/qr-codes");
  return (
    <>
      <PageHeader icon={<QrCode />} title="QR codes" description="Moderate public-facing codes: dynamic redirects and hosted pages. Static codes are private content and are only counted." />
      <QrCodesView />
    </>
  );
}
