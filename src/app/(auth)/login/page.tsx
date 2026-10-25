import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { googleConfigured } from "@/lib/config";
import { LoginForm } from "../auth-ui";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getUser()) redirect("/dashboard");
  return <Suspense><LoginForm google={googleConfigured()} /></Suspense>;
}
