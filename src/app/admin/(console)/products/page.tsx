import type { Metadata } from "next";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { CatalogView } from "./catalog-view";

export const metadata: Metadata = { title: "Products & inventory" };

export default async function AdminProductsPage() {
  await requirePageAdmin("/admin/products");
  return (
    <>
      <PageHeader icon={<Package />} title="Products, barcodes & inventory"
        description="Platform-wide totals only. Product catalogues belong to each account and aren't browsable by administrators." />
      <CatalogView />
    </>
  );
}
