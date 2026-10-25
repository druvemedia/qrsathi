export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated {updated}</p>
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        Template text for operators of this software. Have it reviewed by a lawyer for your jurisdiction (e.g. India&apos;s DPDP Act 2023) before going live.
      </div>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </div>
  );
}
