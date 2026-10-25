"use client";
import { useState } from "react";
import { QrCode, ScanLine, Smartphone, StickyNote } from "lucide-react";
import type { QrDesign } from "@/lib/qr-render";
import { cn } from "@/lib/utils";
import { PreviewChecks, useRendered } from "./preview";

type View = "code" | "print" | "phone";

/** What a phone camera would offer to open, derived from the real payload. */
function scanTarget(payload: string) {
  if (/^https?:\/\//i.test(payload)) {
    try { return new URL(payload).hostname.replace(/^www\./, ""); } catch { return ""; }
  }
  const scheme = payload.match(/^([a-z]+):/i)?.[1]?.toLowerCase();
  return ({ upi: "UPI payment", wifi: "Join Wi-Fi network", mailto: "Send e-mail", tel: "Call number", smsto: "Send SMS", sms: "Send SMS", begin: "Add to contacts or calendar", geo: "Open location" } as Record<string, string>)[scheme || ""]
    ?? (payload.startsWith("BEGIN:") ? "Add to contacts or calendar" : "Show text");
}

/**
 * The generator's large live preview. "Print" and "Phone" are illustrations of
 * where the real, rendered code will be used — the code itself is identical.
 */
export function PreviewStage({ payload, design, invalid, invalidText = "Fix the highlighted fields to update", placeholderNote, title }: {
  payload: string; design: QrDesign; invalid?: boolean; invalidText?: string; placeholderNote?: string; title: string;
}) {
  const [view, setView] = useState<View>("code");
  const { result, error } = useRendered(payload, design);
  const svg = result?.svg;

  const code = (cls: string) =>
    svg ? (
      <div className={cn("transition duration-300 [&>svg]:h-auto [&>svg]:w-full", invalid && "opacity-25 blur-[2px]", cls)} dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="QR code preview" />
    ) : (
      <div className="grid aspect-square w-full place-items-center rounded-2xl border border-dashed border-slate-300 px-6 text-center text-sm text-slate-500 dark:border-slate-700">
        <span><ScanLine className="mx-auto mb-2 h-9 w-9 text-slate-300 dark:text-slate-600" aria-hidden />{error || "Fill in the details to see your QR code"}</span>
      </div>
    );

  const views: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "code", label: "Code", icon: <QrCode className="h-3.5 w-3.5" aria-hidden /> },
    { id: "print", label: "On print", icon: <StickyNote className="h-3.5 w-3.5" aria-hidden /> },
    { id: "phone", label: "On a phone", icon: <Smartphone className="h-3.5 w-3.5" aria-hidden /> },
  ];

  return (
    <div>
      <div className="stage relative overflow-hidden rounded-3xl">
        <div className="relative grid min-h-[360px] place-items-center px-6 pb-16 pt-10 sm:min-h-[420px]">
          <div key={view} className="w-full animate-scale-in">
            {view === "code" && (
              <div className={cn("mx-auto w-full max-w-[300px] rounded-[1.75rem] p-4 shadow-pop ring-1 ring-black/5", design.transparent ? "checker" : "bg-white")}>{code("")}</div>
            )}
            {view === "print" && (
              <div className="mx-auto w-full max-w-[250px] [perspective:900px]">
                <div className="origin-bottom rounded-2xl bg-white px-6 pb-6 pt-5 text-center text-zinc-900 shadow-pop ring-1 ring-black/5 [transform:rotateX(8deg)]">
                  <p className="truncate font-serif text-lg leading-tight">{title}</p>
                  <div className="mx-auto mt-3 w-full">{code("")}</div>
                  <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Point your camera here</p>
                </div>
                <div className="mx-auto h-3 w-[86%] rounded-b-2xl bg-black/10 blur-[6px]" aria-hidden />
              </div>
            )}
            {view === "phone" && (
              <div className="mx-auto w-[220px] rounded-[2.4rem] bg-zinc-900 p-2.5 shadow-pop ring-1 ring-white/10">
                <div className="relative overflow-hidden rounded-[1.9rem] bg-gradient-to-b from-zinc-700 to-zinc-800 px-7 pb-10 pt-16">
                  <div className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-black" aria-hidden />
                  {svg && !invalid && (
                    <div className="absolute inset-x-3 top-8 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-left text-[11px] text-zinc-900 shadow-lg animate-fade-up">
                      <QrCode className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                      <span className="min-w-0"><span className="block text-[10px] text-zinc-500">QR code</span><span className="block truncate font-medium">{scanTarget(payload)}</span></span>
                    </div>
                  )}
                  <div className="relative mt-6">
                    <div className="rounded-lg bg-white p-2">{code("")}</div>
                    {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "left-0 bottom-0 border-l-2 border-b-2", "right-0 bottom-0 border-r-2 border-b-2"].map((c) => (
                      <span key={c} className={cn("absolute -m-2 h-6 w-6 rounded-sm border-amber-300", c)} aria-hidden />
                    ))}
                    <span className="scan-line pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-amber-300/80 shadow-[0_0_12px_2px_rgba(252,211,77,.6)]" aria-hidden />
                  </div>
                </div>
              </div>
            )}
          </div>
          {invalid && svg && (
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow dark:bg-slate-900/95 dark:text-slate-200">{invalidText}</p>
          )}
        </div>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-zinc-900/80 dark:ring-white/10" role="group" aria-label="Preview view">
          {views.map((v) => (
            <button key={v.id} type="button" onClick={() => setView(v.id)} aria-pressed={view === v.id}
              className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                view === v.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white")}>
              {v.icon}{v.label}
            </button>
          ))}
        </div>
      </div>

      {placeholderNote && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{placeholderNote}</p>
      )}
      {result && !invalid && <PreviewChecks result={result} payload={payload} design={design} className="mt-3" />}
    </div>
  );
}
