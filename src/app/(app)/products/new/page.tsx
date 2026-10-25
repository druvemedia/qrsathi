import type { Metadata } from "next";
import { Suspense } from "react";
import { PackagePlus } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { ProductEditor } from "@/components/products/product-editor";

export const metadata: Metadata = { title: "New product", robots: { index: false } };

export default async function NewProductPage() {
  await requirePageUser("/products/new");
  return (
    <>
      <PageHeader icon={<PackagePlus className="h-6 w-6" />} title="New product" description="Add product details, attach barcodes and print labels." />
      <Suspense fallback={<Spinner />}><ProductEditor /></Suspense>
    </>
  );
}
