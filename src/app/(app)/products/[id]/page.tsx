import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader, Spinner } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { ProductEditor } from "@/components/products/product-editor";

export const metadata: Metadata = { title: "Product", robots: { index: false } };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/products/${id}`);
  const p = await db.product.findUnique({ where: { id }, select: { userId: true, name: true, sku: true } });
  if (!p || p.userId !== user.id) notFound();
  return (
    <>
      <PageHeader icon={<Package className="h-6 w-6" />} title={p.name} description={`SKU ${p.sku}`} />
      <Suspense fallback={<Spinner />}><ProductEditor id={id} /></Suspense>
    </>
  );
}
