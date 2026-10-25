import type { Metadata } from "next";
import { Server } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { SystemView } from "./system-view";

export const metadata: Metadata = { title: "System" };

export default async function AdminSystemPage() {
  await requirePageAdmin("/admin/system");
  return (
    <>
      <PageHeader icon={<Server />} title="System status" description="Health checks, configuration (shown as on/off — secret values are never displayed) and the application error log." />
      <SystemView />
    </>
  );
}
