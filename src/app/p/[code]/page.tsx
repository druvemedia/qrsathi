import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { recordScan } from "@/lib/scans";
import { ipFromHeaders } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { HostedPage } from "@/components/hosted-page";

type Props = { params: Promise<{ code: string }> };

async function load(code: string) {
  return db.qrCode.findUnique({ where: { shortCode: code }, include: { user: { select: { status: true } } } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const qr = await load((await params).code);
  if (!qr?.isHosted) return { title: "Not found", robots: { index: false } };
  const c = JSON.parse(qr.content);
  return { title: c.title || c.name || c.restaurant || c.business || c.appName || qr.name, robots: { index: false, follow: false } };
}

export default async function HostedRoute({ params }: Props) {
  const { code } = await params;
  const qr = await load(code);
  if (!qr || !qr.isHosted) notFound();
  const settings = await getSettings();

  const blocked =
    qr.status === "disabled" || qr.user.status !== "active" ? "This page has been disabled."
    : qr.status === "paused" ? "The owner has temporarily paused this page."
    : qr.expiresAt && qr.expiresAt < new Date() ? "This page has expired."
    : null;

  if (blocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center text-slate-900">
        <div className="max-w-sm rounded-3xl bg-white p-8 shadow-xl">
          <p className="text-4xl">⚠️</p>
          <h1 className="mt-3 text-xl font-bold">Unavailable</h1>
          <p className="mt-2 text-slate-600">{blocked}</p>
        </div>
      </div>
    );
  }

  const h = await headers();
  await recordScan(qr, h, ipFromHeaders(h));

  return (
    <div className="min-h-screen bg-slate-50">
      <HostedPage type={qr.type} content={JSON.parse(qr.content)} />
      <footer className="pb-8 text-center text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-600">Made with {settings.siteName}</Link>
        <span className="mx-2">·</span>
        <Link href={`/report?code=${encodeURIComponent(code)}`} className="hover:text-slate-600">Report this page</Link>
      </footer>
    </div>
  );
}
