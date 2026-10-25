import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/session";
import { AdminLoginForm } from "../admin-auth-ui";

export const metadata: Metadata = { title: "Administrator sign-in" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  return <Suspense><AdminLoginForm /></Suspense>;
}
