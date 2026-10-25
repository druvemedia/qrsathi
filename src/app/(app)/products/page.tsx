import type { Metadata } from "next";
import { Suspense } from "react";
import { Package } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { ProductsList } from "./products-list";

export const metadata: Metadata = { title: "Products", robots: { index: false } };

export default async function ProductsPage() {
  await requirePageUser("/products");
  return (
    <>
      <PageHeader icon={<Package className="h-6 w-6" />} title="Products" description="Your product catalogue with SKUs, barcodes, prices and stock. Import, export and print labels in bulk." />
      <Suspense fallback={<Spinner />}><ProductsList /></Suspense>
    </>
  );
}
