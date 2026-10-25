import type { Metadata } from "next";
import { Gauge } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { OverviewView } from "./overview-view";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  await requirePageAdmin("/admin");
  return (
    <>
      <PageHeader icon={<Gauge />} title="Platform overview" description="Live counts from the database. Nothing here is estimated or sampled." />
      <OverviewView />
    </>
  );
}
