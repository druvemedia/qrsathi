import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getUser, publicUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { assetUrl, themeCss } from "@/lib/branding";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Editorial display face, used sparingly for marketing headlines.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["400", "500", "600"], style: ["normal", "italic"] });

export async function generateMetadata(): Promise<Metadata> {
  const { branding: b } = await getSettings();
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const og = assetUrl(b.ogImage);
  const icon = assetUrl(b.favicon);
  return {
    metadataBase: new URL(base),
    title: { default: b.siteTitle, template: b.titleTemplate },
    description: b.metaDescription || b.shortDescription,
    applicationName: b.brandName,
    openGraph: {
      type: "website",
      siteName: b.brandName,
      title: b.ogTitle || b.siteTitle,
      description: b.ogDescription || b.metaDescription || b.shortDescription,
      ...(og ? { images: [{ url: og }] } : {}),
    },
    twitter: { card: og ? "summary_large_image" : "summary", title: b.ogTitle || b.siteTitle, description: b.ogDescription || b.metaDescription || b.shortDescription, ...(og ? { images: [og] } : {}) },
    icons: { icon: icon ?? "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

// Applies the visitor's saved theme (or the site default) before paint to avoid a flash.
const themeScript = (fallback: string) =>
  `(function(){try{var t=localStorage.getItem('theme')||${JSON.stringify(fallback)};var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, user] = await Promise.all([getSettings(), getUser()]);
  const clientUser = user ? await publicUser(user) : null;
  const b = settings.branding;
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <head>
        {/* Both values are validated server-side (enum / #rrggbb), so they can't inject markup. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript(b.defaultTheme) }} />
        <style dangerouslySetInnerHTML={{ __html: themeCss(b) }} />
      </head>
      <body className="min-h-screen font-sans">
        <Providers user={clientUser} settings={settings}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
