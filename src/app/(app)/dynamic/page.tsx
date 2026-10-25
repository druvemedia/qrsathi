import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { DynamicList } from "./dynamic-list";

export const metadata: Metadata = { title: "Dynamic QR codes", robots: { index: false } };

export default async function DynamicPage() {
  await requirePageUser("/dynamic");
  return (
    <>
      <PageHeader icon={<RefreshCw className="h-6 w-6" />} title="Dynamic QR Management" description="Change destinations, pause or resume, and track every dynamic code and hosted page." />
      <DynamicList />
    </>
  );
}
