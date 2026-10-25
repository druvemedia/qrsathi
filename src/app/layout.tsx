import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getUser, publicUser } from "@/lib/session";
import { BRAND_COLORS, getSettings } from "@/lib/settings";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: { default: `${s.siteName} — ${s.tagline}`, template: `%s · ${s.siteName}` },
    description:
      "Free QR code generator for India: UPI payment QR, Wi-Fi, WhatsApp, vCard, menus, dynamic QR codes with analytics, bulk generation and a QR scanner.",
    keywords: ["QR code generator", "UPI QR code", "dynamic QR code", "bulk QR", "QR scanner", "India", "PhonePe", "Google Pay", "Paytm", "BHIM"],
    openGraph: { type: "website", siteName: s.siteName, title: s.siteName, description: s.tagline },
    twitter: { card: "summary_large_image", title: s.siteName, description: s.tagline },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

// Applies the saved/system theme before paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, user] = await Promise.all([getSettings(), getUser()]);
  const brand = BRAND_COLORS[settings.brand] || BRAND_COLORS.indigo;
  return (
    <html lang="en" suppressHydrationWarning className={sans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style dangerouslySetInnerHTML={{ __html: `:root{--brand:${brand.hsl};--accent:${brand.accent}}` }} />
      </head>
      <body className="min-h-screen font-sans">
        <Providers user={user ? publicUser(user) : null} settings={settings}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
