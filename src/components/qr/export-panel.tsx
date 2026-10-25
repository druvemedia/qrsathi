"use client";
import { useMemo, useState } from "react";
import { Download, Lock, Printer } from "lucide-react";
import { toast } from "sonner";
import { renderQr, type QrDesign } from "@/lib/qr-render";
import { buildPdf, downloadBlob, exportSvg, type ExportFormat, type PaperSize } from "@/lib/qr-export";
import { POSTER_THEMES, renderPosterSvg, type PosterContent } from "@/lib/poster";
import { Button, Field, Input, Modal, Segmented, Select } from "@/components/ui";
import { useApp } from "@/components/providers";
import { safeFilename, cn } from "@/lib/utils";

export async function trackDownload(user: unknown, name: string, format: string, qrId?: string | null) {
  if (!user) return;
  fetch("/api/downloads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, format, qrId: qrId || null }) }).catch(() => {});
}

interface Props {
  payload: string;
  design: QrDesign;
  name: string;
  qrId?: string | null;
  disabledReason?: string;
  posterDefaults?: Partial<PosterContent>;
}

export function ExportPanel({ payload, design, name, qrId, disabledReason, posterDefaults }: Props) {
  const { user } = useApp();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [size, setSize] = useState(1024);
  const [paper, setPaper] = useState<PaperSize>("a4");
  const [mm, setMm] = useState(80);
  const [layout, setLayout] = useState<"single" | "grid">("single");
  const [busy, setBusy] = useState(false);
  const [poster, setPoster] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const { svg } = renderQr(payload, design, { idPrefix: "ex" });
      const file = safeFilename(name);
      if (format === "pdf") {
        const blob = await buildPdf([{ svg }], { paper, sizeMm: mm, layout });
        downloadBlob(blob, `${file}.pdf`);
      } else {
        downloadBlob(await exportSvg(svg, format, size), `${file}.${format}`);
      }
      trackDownload(user, name, format, qrId);
      toast.success(`Downloaded ${format.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Segmented value={format} onChange={setFormat} className="w-full" options={[{ value: "png", label: "PNG" }, { value: "jpg", label: "JPG" }, { value: "svg", label: "SVG" }, { value: "pdf", label: "PDF" }]} />
      {(format === "png" || format === "jpg") && (
        <Field label="Resolution">
          <Select value={size} onChange={(e) => setSize(+e.target.value)}>
            <option value={512}>512 px — web & WhatsApp</option>
            <option value={1024}>1024 px — standard</option>
            <option value={2048}>2048 px — high resolution</option>
            <option value={4096}>4096 px — print / large format</option>
          </Select>
        </Field>
      )}
      {format === "svg" && <p className="hint">Vector — scales to any size without blur. Best for designers and large prints.</p>}
      {format === "pdf" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paper">
            <Select value={paper} onChange={(e) => setPaper(e.target.value as PaperSize)}>
              <option value="a4">A4</option><option value="a5">A5</option><option value="a6">A6</option><option value="letter">US Letter</option><option value="fit">Fit to QR</option>
            </Select>
          </Field>
          <Field label="QR width (mm)">
            <Input type="number" min={20} max={200} value={mm} onChange={(e) => setMm(Math.max(20, Math.min(200, +e.target.value || 20)))} />
          </Field>
          {paper !== "fit" && (
            <Field label="Layout" className="col-span-2">
              <Segmented size="sm" value={layout} onChange={setLayout} options={[{ value: "single", label: "Single, centred" }, { value: "grid", label: "Sheet of copies (stickers)" }]} />
            </Field>
          )}
          <p className="hint col-span-2">Printed at 300 DPI. Keep QR codes at least 20 mm wide; ~1 cm per 10 cm of scanning distance.</p>
        </div>
      )}
      {disabledReason ? (
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Lock className="h-4 w-4 shrink-0" /> {disabledReason}
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button size="lg" variant="gradient" onClick={download} loading={busy}>
            <Download className="h-4 w-4" /> Download {format.toUpperCase()}
          </Button>
          <Button size="lg" variant="outline" onClick={() => setPoster(true)} title="Poster / standee">
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Poster</span>
          </Button>
        </div>
      )}
      <PosterDialog open={poster} onClose={() => setPoster(false)} payload={payload} design={design} name={name} qrId={qrId} defaults={posterDefaults} />
    </div>
  );
}

export function PosterDialog({ open, onClose, payload, design, name, qrId, defaults }: {
  open: boolean; onClose: () => void; payload: string; design: QrDesign; name: string; qrId?: string | null; defaults?: Partial<PosterContent>;
}) {
  const { user } = useApp();
  const [c, setC] = useState<PosterContent>({
    headline: "Scan me", title: name || "Your business", subtitle: "", highlight: "", detail: "", footer: "Point your phone camera at the code", disclaimer: "",
    ...defaults,
  });
  const [themeId, setThemeId] = useState(defaults?.headline?.toLowerCase().includes("pay") ? "saffron" : "indigo");
  const [busy, setBusy] = useState<string | null>(null);
  const theme = POSTER_THEMES.find((t) => t.id === themeId) || POSTER_THEMES[0];

  const svg = useMemo(() => {
    if (!open) return "";
    try {
      // Poster QR: keep it plain & high-contrast; frame text lives on the poster itself.
      const qr = renderQr(payload, { ...design, frame: "none", textAbove: "", textBelow: "", pattern: "none" }, { idPrefix: "ps" });
      return renderPosterSvg(qr, c, theme);
    } catch {
      return "";
    }
  }, [open, payload, design, c, theme]);

  const save = async (kind: "png" | "pdf-a4" | "pdf-a5") => {
    setBusy(kind);
    try {
      const file = safeFilename(`${name || "qr"}-poster`);
      if (kind === "png") downloadBlob(await exportSvg(svg, "png", 2480), `${file}.png`);
      else {
        const a4 = kind === "pdf-a4";
        downloadBlob(await buildPdf([{ svg }], { paper: a4 ? "a4" : "a5", sizeMm: a4 ? 210 : 148, layout: "single", marginMm: 0 }), `${file}-${a4 ? "A4" : "A5"}.pdf`);
      }
      trackDownload(user, `${name} poster`, kind, qrId);
      toast.success("Poster downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const f = (k: keyof PosterContent, label: string, max = 60) => (
    <Field label={label}><Input value={c[k] || ""} maxLength={max} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></Field>
  );

  return (
    <Modal open={open} onClose={onClose} title="Print-ready poster / standee" size="lg"
      footer={<>
        <Button variant="outline" onClick={() => save("png")} loading={busy === "png"}>PNG (300 DPI)</Button>
        <Button variant="outline" onClick={() => save("pdf-a5")} loading={busy === "pdf-a5"}>PDF A5</Button>
        <Button onClick={() => save("pdf-a4")} loading={busy === "pdf-a4"}><Printer className="h-4 w-4" /> PDF A4</Button>
      </>}>
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">{f("headline", "Headline", 24)}{f("title", "Name / title")}</div>
          {f("subtitle", "Subtitle")}
          <div className="grid grid-cols-2 gap-3">{f("highlight", "Highlight (e.g. ₹ 250)", 24)}{f("detail", "Detail line")}</div>
          {f("footer", "Footer")}
          {f("disclaimer", "Small print", 110)}
          <div>
            <span className="label">Theme</span>
            <div className="flex flex-wrap gap-2">
              {POSTER_THEMES.map((t) => (
                <button key={t.id} type="button" onClick={() => setThemeId(t.id)} aria-pressed={t.id === themeId}
                  className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", t.id === themeId ? "border-brand ring-2 ring-brand/20" : "border-slate-200 dark:border-slate-700")}>
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.primary }} /> {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
          <div className="overflow-hidden rounded-lg shadow-lg [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </div>
    </Modal>
  );
}
