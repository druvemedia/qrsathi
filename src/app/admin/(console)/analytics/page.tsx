import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { AnalyticsView } from "./analytics-view";

export const metadata: Metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage() {
  await requirePageAdmin("/admin/analytics");
  return (
    <>
      <PageHeader icon={<BarChart3 />} title="Platform analytics" description="Aggregate activity across all accounts. Individual scan records aren't shown." />
      <AnalyticsView />
    </>
  );
}
