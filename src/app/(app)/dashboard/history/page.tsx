import type { Metadata } from "next";
import { History } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { DownloadHistory } from "./history";

export const metadata: Metadata = { title: "Download history", robots: { index: false } };

export default async function HistoryPage() {
  await requirePageUser("/dashboard/history");
  return (
    <>
      <PageHeader icon={<History className="h-6 w-6" />} title="Download history" description="Files you downloaded while signed in." />
      <DownloadHistory />
    </>
  );
}
