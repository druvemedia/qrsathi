import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/guard";
import { getType } from "@/lib/qr-types";
import { Badge, LinkButton, PageHeader } from "@/components/ui";
import { AnalyticsView } from "@/components/analytics-view";

export const metadata: Metadata = { title: "QR analytics", robots: { index: false } };

export default async function QrAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/analytics/${id}`);
  const qr = await db.qrCode.findUnique({ where: { id } });
  if (!qr || qr.userId !== user.id) notFound();
  const t = getType(qr.type);
  return (
    <>
      <Link href="/analytics" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> All analytics</Link>
      <PageHeader icon={<BarChart3 className="h-6 w-6" />} title={qr.name}
        description={<span className="flex flex-wrap items-center gap-2">
          <Badge tone="violet">{t.label}</Badge>
          <Badge tone={qr.status === "active" ? "green" : "amber"}>{qr.status}</Badge>
          {qr.campaign && <Badge>{qr.campaign}</Badge>}
          {qr.shortCode && <a href={qr.payload} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-brand">{qr.payload} <ExternalLink className="h-3 w-3" /></a>}
        </span>}
        actions={<LinkButton href={`/generator?id=${qr.id}`} variant="outline">Edit QR</LinkButton>} />
      {!qr.isDynamic ? (
        <p className="text-sm text-slate-500">This is a static QR code — its content is stored in the image itself, so scans can&apos;t be counted. Create a dynamic QR to track scans.</p>
      ) : (
        <AnalyticsView qrId={qr.id} isUpi={qr.type === "upi" || qr.type === "bank"} />
      )}
    </>
  );
}
