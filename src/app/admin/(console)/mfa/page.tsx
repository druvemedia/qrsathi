import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requirePageAdmin } from "@/lib/guard";
import { MfaView } from "./mfa-view";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function AdminMfaPage() {
  await requirePageAdmin("/admin/mfa", { allowWithoutMfa: true });
  return (
    <>
      <PageHeader icon={<KeyRound />} title="Two-factor authentication" description="Protect your administrator account with a time-based code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy and others)." />
      <MfaView />
    </>
  );
}
