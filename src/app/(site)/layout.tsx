import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbfbf9] text-zinc-900 dark:bg-[#0b0b0d] dark:text-zinc-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop">Skip to content</a>
      <SiteHeader />
      <main id="main" className="animate-page-in">{children}</main>
      <SiteFooter />
    </div>
  );
}
