"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, ScanLine, XCircle } from "lucide-react";
import { designWarnings, renderQr, type QrDesign, type RenderResult } from "@/lib/qr-render";
import { scanTest } from "@/lib/qr-export";
import { cn } from "@/lib/utils";

export function useRendered(payload: string, design: QrDesign) {
  return useMemo(() => {
    if (!payload) return { result: null as RenderResult | null, error: "" };
    try {
      return { result: renderQr(payload, design, { idPrefix: "pv" }), error: "" };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : "Could not generate the QR code." };
    }
  }, [payload, design]);
}

type ScanState = "idle" | "testing" | "pass" | "fail";

/** Re-runs a real decode of the rendered design whenever it changes (debounced). */
export function useScanTest(svg: string | undefined, payload: string) {
  const [state, setState] = useState<ScanState>("idle");
  useEffect(() => {
    if (!svg) return setState("idle");
    setState("testing");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await scanTest(svg, payload);
        if (!cancelled) setState(r.ok ? "pass" : "fail");
      } catch {
        if (!cancelled) setState("idle");
      }
    }, 550);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [svg, payload]);
  return state;
}

export function QrPreview({
  payload, design, invalid, invalidText = "Fix the highlighted fields to update", placeholderNote, className, showChecks = true,
}: { payload: string; design: QrDesign; invalid?: boolean; invalidText?: string; placeholderNote?: string; className?: string; showChecks?: boolean }) {
  const { result, error } = useRendered(payload, design);
  const scan = useScanTest(showChecks ? result?.svg : undefined, payload);
  const warnings = useMemo(() => (showChecks ? designWarnings(design) : []), [design, showChecks]);

  return (
    <div className={className}>
      <div className={cn("relative mx-auto grid aspect-square w-full max-w-[340px] place-items-center rounded-xl p-5", design.transparent ? "checker" : "bg-slate-100 dark:bg-slate-800/60")}>
        {result ? (
          <div
            className={cn("w-full transition duration-300 [&>svg]:h-auto [&>svg]:w-full [&>svg]:drop-shadow-sm", invalid && "opacity-30 blur-[2px]")}
            dangerouslySetInnerHTML={{ __html: result.svg }}
            role="img"
            aria-label="QR code preview"
          />
        ) : (
          <div className="px-6 text-center text-sm text-slate-500">
            <ScanLine className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            {error || "Fill in the form to see your QR code"}
          </div>
        )}
        {invalid && result && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <p className="rounded-xl bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow dark:bg-slate-900/95 dark:text-slate-200">{invalidText}</p>
          </div>
        )}
      </div>

      {placeholderNote && (
        <p className="mx-auto mt-3 max-w-[340px] rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{placeholderNote}</p>
      )}

      {showChecks && result && !invalid && (
        <div className="mx-auto mt-4 max-w-[340px] space-y-2">
          <div className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium",
            scan === "pass" && "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200",
            scan === "fail" && "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200",
            (scan === "testing" || scan === "idle") && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
          )} aria-live="polite">
            {scan === "testing" && <><Loader2 className="h-4 w-4 animate-spin" /> Testing scan…</>}
            {scan === "pass" && <><CheckCircle2 className="h-4 w-4" /> Scan test passed — decodes to your exact content</>}
            {scan === "fail" && <><XCircle className="h-4 w-4" /> Our test scanner couldn&apos;t read this design. Increase contrast, shrink the logo, or use simpler modules.</>}
            {scan === "idle" && <><ScanLine className="h-4 w-4" /> Scan test pending</>}
          </div>
          <p className="text-center text-[11px] text-slate-400">
            v{result.version} · {result.moduleCount}×{result.moduleCount} modules · error correction {result.ecc} · {payload.length} chars
          </p>
          {warnings.map((w, i) => (
            <div key={i} className={cn("flex gap-2 rounded-xl px-3 py-2 text-xs", w.level === "warn" ? "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" : "bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200")}>
              {w.level === "warn" ? <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> : <Info className="mt-px h-3.5 w-3.5 shrink-0" />}
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small static thumbnail for lists. */
export function QrThumb({ payload, design, className }: { payload: string; design: Partial<QrDesign>; className?: string }) {
  const svg = useMemo(() => {
    try {
      return renderQr(payload, design, { idPrefix: "th" + Math.abs(hash(payload)).toString(36) }).svg;
    } catch {
      return "";
    }
  }, [payload, design]);
  return <div className={cn("[&>svg]:h-full [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: svg }} aria-hidden />;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
