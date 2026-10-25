import type { Metadata } from "next";
import { Library as LibraryIcon, Plus } from "lucide-react";
import { LinkButton, PageHeader } from "@/components/ui";
import { requirePageUser } from "@/lib/guard";
import { Library } from "./library";

export const metadata: Metadata = { title: "My QR codes", robots: { index: false } };

export default async function CodesPage() {
  await requirePageUser("/codes");
  return (
    <>
      <PageHeader icon={<LibraryIcon />} title="My QR codes" description="Saved static codes, dynamic links and hosted pages."
        actions={<><LinkButton href="/upi" variant="outline">UPI QR</LinkButton><LinkButton href="/generator"><Plus className="h-4 w-4" /> New QR code</LinkButton></>} />
      <Library />
    </>
  );
}
