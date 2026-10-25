"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Download, Palette } from "lucide-react";
import { toast } from "sonner";
import { getType, validateContent } from "@/lib/qr-types";
import { mergeDesign, renderQr, type QrDesign } from "@/lib/qr-render";
import { TEMPLATES } from "@/lib/templates";
import { builtinLogo } from "@/lib/logos";
import { downloadBlob, exportSvg } from "@/lib/qr-export";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { TypeIcon } from "@/components/icon";
import { useApp } from "@/components/providers";
import { QrPreview } from "@/components/qr/preview";
import { TypeForm } from "@/components/qr/type-form";
import { trackDownload } from "@/components/qr/export-panel";
import { DRAFT_KEY } from "@/components/qr/workbench";

const QUICK = ["url", "upi", "whatsapp", "wifi", "text", "vcard"];
const STYLES = ["classic", "scan-me", "pay-here", "aurora", "ocean", "forest"];

export function QuickGenerator({ bare = false }: { bare?: boolean }) {
  const router = useRouter();
  const { user } = useApp();
  const [typeId, setTypeId] = useState("url");
  const [contents, setContents] = useState<Record<string, Record<string, any>>>({});
  const [styleId, setStyleId] = useState("classic");
  const type = getType(typeId);
  const content = contents[typeId] ?? type.defaults;
  const v = useMemo(() => validateContent(type, content), [type, content]);
  const lastGood = useRef("https://example.com");
  if (v.ok) lastGood.current = type.build(v.data, { hostedUrl: "" });
  const payload = lastGood.current;

  const design: QrDesign = useMemo(() => {
    const t = TEMPLATES.find((x) => x.id === styleId)!;
    const d = mergeDesign(t.design);
    if (d.frame !== "none" && type.caption) d.frameText = type.caption;
    if (typeId === "upi" && styleId !== "classic") d.logo = builtinLogo("rupee");
    return d;
  }, [styleId, typeId, type.caption]);

  const download = async (fmt: "png" | "svg") => {
    if (!v.ok) return toast.error("Please fix the highlighted fields first.");
    const { svg } = renderQr(payload, design, { idPrefix: "hq" });
    downloadBlob(await exportSvg(svg, fmt, 1024), `qr-${type.id}.${fmt}`);
    trackDownload(user, `${type.label} QR`, fmt);
    toast.success("Downloaded — free, no watermark");
  };

  const toStudio = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ typeId, contents: { [typeId]: content }, design }));
    } catch {}
    router.push("/studio");
  };

  return (
    <Card className={cn("overflow-hidden", bare ? "rounded-none border-0 bg-transparent shadow-none dark:bg-transparent" : "shadow-pop")}>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2 scrollbar-thin dark:border-slate-800" role="tablist">
        {QUICK.map((id) => {
          const t = getType(id);
          return (
            <button key={id} role="tab" aria-selected={id === typeId} onClick={() => setTypeId(id)}
              className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                id === typeId ? "bg-brand text-white shadow-md shadow-brand/25" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
              <TypeIcon name={t.icon} className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-[1fr_300px] md:p-7">
        <div className="space-y-5">
          <TypeForm key={typeId} type={type} value={content} onChange={(val) => setContents((c) => ({ ...c, [typeId]: val }))} errors={v.errors} showErrors={false} />
          <div>
            <p className="label">Style</p>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((id) => {
                const t = TEMPLATES.find((x) => x.id === id)!;
                const d = mergeDesign(t.design);
                const sw = d.gradient.enabled ? `linear-gradient(135deg, ${d.gradient.from}, ${d.gradient.to})` : d.frame !== "none" ? d.frameColor : d.fg;
                return (
                  <button key={id} onClick={() => setStyleId(id)} aria-pressed={id === styleId}
                    className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition", id === styleId ? "border-brand ring-2 ring-brand/20" : "border-slate-200 hover:border-slate-300 dark:border-slate-700")}>
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: sw }} /> {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div>
          <QrPreview payload={payload} design={design} invalid={!v.ok && Object.keys(contents).length > 0} showChecks={false} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="gradient" onClick={() => download("png")}><Download className="h-4 w-4" /> PNG</Button>
            <Button variant="outline" onClick={() => download("svg")}><Download className="h-4 w-4" /> SVG</Button>
          </div>
          <Button variant="ghost" className="mt-2 w-full" onClick={toStudio}><Palette className="h-4 w-4" /> Customize in Studio</Button>
        </div>
      </div>
    </Card>
  );
}
