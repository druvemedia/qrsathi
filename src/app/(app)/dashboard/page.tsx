import type { Metadata } from "next";
import { requirePageUser } from "@/lib/guard";
import { OverviewView } from "./overview";

export const metadata: Metadata = { title: "Overview", robots: { index: false } };

export default async function DashboardPage() {
  await requirePageUser("/dashboard");
  return <OverviewView />;
}
