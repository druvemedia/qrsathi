import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "../auth-ui";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ResetPage() {
  return <Suspense><ResetForm /></Suspense>;
}
