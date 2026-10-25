import type { Metadata } from "next";
import { IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { UpiTool } from "./upi-tool";

export const metadata: Metadata = {
  title: "UPI Payment QR Code Generator",
  description: "Create a free UPI QR code for your shop — works with Google Pay, PhonePe, Paytm and BHIM. Fixed or open amount, printable standee, instant download.",
};

export default function UpiPage() {
  return (
    <>
      <PageHeader icon={<IndianRupee className="h-6 w-6" />} title="UPI Payment QR"
        description="Generate a standards-compatible upi://pay QR for your shop or invoice. Customers scan with any UPI app, check the details and pay with their own PIN." />
      <UpiTool />
    </>
  );
}
