import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { googleConfigured } from "@/lib/config";
import { SignupForm } from "../auth-ui";

export const metadata: Metadata = { title: "Sign up free" };

export default async function SignupPage() {
  if (await getUser()) redirect("/dashboard");
  return <Suspense><SignupForm google={googleConfigured()} /></Suspense>;
}
