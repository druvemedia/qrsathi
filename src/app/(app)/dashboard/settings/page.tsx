import type { Metadata } from "next";
import { Suspense } from "react";
import { Settings } from "lucide-react";
import { PageHeader, Spinner } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { AccountSettings } from "./settings";

export const metadata: Metadata = { title: "Account settings", robots: { index: false } };

export default async function SettingsPage() {
  await requirePageUser("/dashboard/settings");
  return (
    <>
      <PageHeader icon={<Settings className="h-6 w-6" />} title="Account settings" description="Profile, security, plan and data." />
      <Suspense fallback={<Spinner />}><AccountSettings /></Suspense>
    </>
  );
}
