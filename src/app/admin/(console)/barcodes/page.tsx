import type { Metadata } from "next";
import { Barcode } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { BarcodesView } from "./barcodes-view";

export const metadata: Metadata = { title: "Barcodes" };

export default async function AdminBarcodesPage() {
  await requirePageAdmin("/admin/barcodes");
  return (
    <>
      <PageHeader icon={<Barcode />} title="Barcodes" description="Platform-wide totals of barcodes stored on products. Individual catalogues stay private to each account." />
      <BarcodesView />
    </>
  );
}
