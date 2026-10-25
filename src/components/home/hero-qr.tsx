"use client";
import { useMemo, useState } from "react";
import { Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import { mergeDesign, renderQr } from "@/lib/qr-render";
import { TEMPLATES } from "@/lib/templates";
import { downloadBlob, exportSvg } from "@/lib/qr-export";
import { isHttpUrl, normalizeUrl, cn } from "@/lib/utils";

const STYLES = ["classic", "aurora", "ocean", "forest", "follow", "midnight"];

/** Hero playground: type a link, pick a style, watch the real code update. */
export function HeroQr() {
  const [text, setText] = useState("");
  const [styleId, setStyleId] = useState("aurora");
  const url = normalizeUrl(text.trim());
  const valid = !text.trim() || isHttpUrl(url);
  const payload = text.trim() && valid ? url : "https://example.com";

  const design = useMemo(() => mergeDesign({ ...TEMPLATES.find((t) => t.id === styleId)!.design, margin: 2 }), [styleId]);
  const svg = useMemo(() => {
    try { return renderQr(payload, design, { idPrefix: "hero" }).svg; } catch { return ""; }
  }, [payload, design]);

  const download = async () => {
    if (!text.trim() || !valid) return toast.error("Enter your own link first.");
    downloadBlob(await exportSvg(renderQr(payload, design, { idPrefix: "hx" }).svg, "png", 1024), "qr-code.png");
    toast.success("Downloaded — free, no watermark");
  };

  return (
    <div className="relative w-full max-w-[400px]">
      <div className="stage relative rounded-[2rem] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,.35)] ring-1 ring-black/5 dark:ring-white/10 sm:p-8">
        <div className="mx-auto w-full max-w-[280px] rounded-[1.5rem] bg-white p-4 shadow-pop">
          <div key={styleId} className="animate-scale-in [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`QR code for ${payload}`} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <div className="mt-6 flex justify-center gap-2" role="group" aria-label="QR style">
          {STYLES.map((id) => {
            const t = TEMPLATES.find((x) => x.id === id)!;
            const d = mergeDesign(t.design);
            const sw = d.gradient.enabled ? `linear-gradient(135deg, ${d.gradient.from}, ${d.gradient.to})` : d.frame !== "none" ? d.frameColor : d.fg;
            return (
              <button key={id} type="button" onClick={() => setStyleId(id)} aria-pressed={id === styleId} aria-label={`${t.name} style`} title={t.name}
                className={cn("h-7 w-7 rounded-full ring-1 ring-black/10 transition duration-200 hover:scale-110", id === styleId && "ring-2 ring-zinc-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-zinc-900")}
                style={{ background: sw }} />
            );
          })}
        </div>
      </div>
      <form className="relative -mt-5 mx-4 flex items-center gap-2 rounded-2xl bg-white p-1.5 pl-3.5 shadow-pop ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
        onSubmit={(e) => { e.preventDefault(); download(); }}>
        <Link2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your link" aria-label="Link to encode" aria-invalid={!valid}
          className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400", !valid && "text-rose-600")} />
        <button type="submit" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-950 px-3 text-xs font-medium text-white transition hover:bg-zinc-800 active:scale-[.97] dark:bg-white dark:text-zinc-950">
          <Download className="h-3.5 w-3.5" aria-hidden /> PNG
        </button>
      </form>
      {!valid && <p className="mt-2 text-center text-xs text-rose-600">Enter a web address, e.g. yourshop.in</p>}
    </div>
  );
}
