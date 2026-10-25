import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { AnalyticsView } from "@/components/analytics-view";
import { requirePageUser } from "@/lib/guard";

export const metadata: Metadata = { title: "Analytics", robots: { index: false } };

export default async function AnalyticsPage() {
  await requirePageUser("/analytics");
  return (
    <>
      <PageHeader icon={<BarChart3 className="h-6 w-6" />} title="Analytics" description="Scan activity across all your dynamic QR codes and hosted pages." />
      <AnalyticsView />
    </>
  );
}
