import type { Metadata } from "next";
import { Warehouse } from "lucide-react";
import { LinkButton, PageHeader } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { InventoryView } from "./inventory-view";

export const metadata: Metadata = { title: "Inventory", robots: { index: false } };

export default async function InventoryPage() {
  await requirePageUser("/inventory");
  return (
    <>
      <PageHeader icon={<Warehouse className="h-6 w-6" />} title="Inventory" description="Stock levels, low-stock alerts, expiring batches and every stock movement."
        actions={<LinkButton href="/products" variant="outline">All products</LinkButton>} />
      <InventoryView />
    </>
  );
}
