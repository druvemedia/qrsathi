"use client";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { mergeDesign, renderQr, type QrDesign } from "@/lib/qr-render";
import { TEMPLATES } from "@/lib/templates";
import { BUILTIN_LOGOS } from "@/lib/logos";
import { fileToLogoDataUrl } from "@/lib/qr-export";
import { Button, ColorInput, Field, Input, Segmented, Select, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";

const CAPTIONS = ["SCAN ME", "PAY HERE", "SCAN & PAY", "FOLLOW US", "VIEW MENU", "FREE WI-FI", "REVIEW US", "GET OFFER"];

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 last:border-0 dark:border-slate-800">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-3.5 text-left text-sm font-semibold" aria-expanded={open}>
        {title}
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-4 pb-5">{children}</div>}
    </div>
  );
}

function Mini({ design, active, onClick, label }: { design: Partial<QrDesign>; active: boolean; onClick: () => void; label: string }) {
  const svg = useMemo(() => {
    try {
      return renderQr("https://qr.example/x", mergeDesign(design), { idPrefix: "mini-" + label.replace(/\W/g, "") }).svg;
    } catch {
      return "";
    }
  }, [design, label]);
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-xl border p-2 transition",
        active ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
      )}
    >
      <div className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
    </button>
  );
}

export function DesignPanel({ design, onChange, compact = false }: { design: QrDesign; onChange: (d: QrDesign) => void; compact?: boolean }) {
  const set = <K extends keyof QrDesign>(k: K, v: QrDesign[K]) => onChange({ ...design, [k]: v });
  const setG = (patch: Partial<QrDesign["gradient"]>) => onChange({ ...design, gradient: { ...design.gradient, ...patch } });
  const fileRef = useRef<HTMLInputElement>(null);
  const base = { ...design, logo: null, frame: "none" as const, textAbove: "", textBelow: "", pattern: "none" as const };

  const uploadLogo = async (f: File) => {
    try {
      const logo = await fileToLogoDataUrl(f);
      onChange({ ...design, logo, ecc: "H" });
      toast.success("Logo added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not use that image");
    }
  };

  return (
    <div>
      <Section title="Templates" defaultOpen>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          {TEMPLATES.map((t) => (
            <Mini key={t.id} label={t.name} design={{ ...mergeDesign(t.design), logo: design.logo }} active={false}
              onClick={() => onChange(mergeDesign({ ...design, ...t.design, gradient: { ...design.gradient, ...(t.design.gradient || {}) }, logo: design.logo, logoSize: design.logoSize, textAbove: design.textAbove, textBelow: design.textBelow }))} />
          ))}
        </div>
      </Section>

      <Section title="Colours" defaultOpen={!compact}>
        <div className="grid grid-cols-2 gap-3">
          {!design.gradient.enabled && <ColorInput label="Modules" value={design.fg} onChange={(v) => set("fg", v)} />}
          <ColorInput label="Background" value={design.bg} onChange={(v) => set("bg", v)} />
        </div>
        <Switch checked={design.transparent} onChange={(v) => set("transparent", v)} label="Transparent background" description="PNG & SVG keep transparency; JPG uses white." />
        <Switch checked={design.gradient.enabled} onChange={(v) => setG({ enabled: v })} label="Gradient modules" />
        {design.gradient.enabled && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
            <Segmented size="sm" value={design.gradient.type} onChange={(v) => setG({ type: v })} options={[{ value: "linear", label: "Linear" }, { value: "radial", label: "Radial" }]} />
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="From" value={design.gradient.from} onChange={(v) => setG({ from: v })} />
              <ColorInput label="To" value={design.gradient.to} onChange={(v) => setG({ to: v })} />
            </div>
            {design.gradient.type === "linear" && (
              <Field label={`Angle: ${design.gradient.rotation}°`}>
                <input type="range" min={0} max={360} step={15} value={design.gradient.rotation} onChange={(e) => setG({ rotation: +e.target.value })} className="w-full accent-[hsl(var(--brand))]" />
              </Field>
            )}
          </div>
        )}
        <Switch checked={!!design.eyeColor} onChange={(v) => set("eyeColor", v ? "#4f46e5" : "")} label="Custom eye colour" />
        {design.eyeColor && <ColorInput label="Eye colour" value={design.eyeColor} onChange={(v) => set("eyeColor", v)} />}
      </Section>

      <Section title="Shapes" defaultOpen={!compact}>
        <div>
          <span className="label">Module style</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(["square", "rounded", "dots", "diamond", "fluid", "bars"] as const).map((s) => (
              <Mini key={s} label={s[0].toUpperCase() + s.slice(1)} design={{ ...base, moduleStyle: s }} active={design.moduleStyle === s} onClick={() => set("moduleStyle", s)} />
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Eye frame</span>
            <div className="grid grid-cols-4 gap-1.5">
              {(["square", "rounded", "circle", "leaf"] as const).map((s) => (
                <EyeChip key={s} kind={s} active={design.eyeOuter === s} onClick={() => set("eyeOuter", s)} outer />
              ))}
            </div>
          </div>
          <div>
            <span className="label">Eye centre</span>
            <div className="grid grid-cols-4 gap-1.5">
              {(["square", "rounded", "circle", "leaf"] as const).map((s) => (
                <EyeChip key={s} kind={s} active={design.eyeInner === s} onClick={() => set("eyeInner", s)} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Logo">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {BUILTIN_LOGOS.map((l) => (
            <button key={l.id} type="button" title={l.label} aria-label={`Use ${l.label} logo`} onClick={() => onChange({ ...design, logo: l.dataUrl })}
              className={cn("aspect-square rounded-xl border p-1.5 transition hover:border-brand", design.logo === l.dataUrl ? "border-brand ring-2 ring-brand/25" : "border-slate-200 dark:border-slate-700")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.dataUrl} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> Upload logo</Button>
          {design.logo && <Button variant="ghost" size="sm" onClick={() => set("logo", null)}><Trash2 className="h-4 w-4" /> Remove</Button>}
        </div>
        {design.logo && (
          <>
            <Field label={`Logo size: ${Math.round(design.logoSize * 100)}%`}>
              <input type="range" min={0.1} max={0.3} step={0.01} value={design.logoSize} onChange={(e) => set("logoSize", +e.target.value)} className="w-full accent-[hsl(var(--brand))]" />
            </Field>
            <Switch checked={design.logoPadding} onChange={(v) => set("logoPadding", v)} label="Clear space behind logo" description="Removes modules under the logo for cleaner scanning." />
          </>
        )}
      </Section>

      <Section title="Frame & caption" defaultOpen={!compact}>
        <div className="grid grid-cols-3 gap-2">
          {(["none", "banner", "banner-top", "badge", "bubble", "outline"] as const).map((f) => (
            <Mini key={f} label={{ none: "None", banner: "Banner", "banner-top": "Top banner", badge: "Badge", bubble: "Bubble", outline: "Outline" }[f]}
              design={{ ...base, frame: f, frameColor: design.frameColor, frameText: "SCAN ME", frameTextColor: design.frameTextColor }} active={design.frame === f} onClick={() => set("frame", f)} />
          ))}
        </div>
        {design.frame !== "none" && (
          <>
            <Field label="Caption">
              <Input value={design.frameText} maxLength={30} onChange={(e) => set("frameText", e.target.value)} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CAPTIONS.map((c) => (
                  <button key={c} type="button" onClick={() => set("frameText", c)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", design.frameText === c ? "border-brand bg-brand/10 text-brand" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300")}>{c}</button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <ColorInput label="Frame" value={design.frameColor} onChange={(v) => set("frameColor", v)} />
              <ColorInput label="Caption" value={design.frameTextColor} onChange={(v) => set("frameTextColor", v)} />
              <ColorInput label="Card" value={design.canvasBg} onChange={(v) => set("canvasBg", v)} />
            </div>
          </>
        )}
      </Section>

      <Section title="Text above / below">
        <Field label="Text above"><Input value={design.textAbove} maxLength={50} placeholder="e.g. Sharma General Store" onChange={(e) => set("textAbove", e.target.value)} /></Field>
        <Field label="Text below"><Input value={design.textBelow} maxLength={50} placeholder="e.g. www.yourshop.in" onChange={(e) => set("textBelow", e.target.value)} /></Field>
        <ColorInput label="Text colour" value={design.textColor} onChange={(v) => set("textColor", v)} />
      </Section>

      <Section title="Background pattern">
        <Segmented size="sm" value={design.pattern} onChange={(v) => set("pattern", v)} options={(["none", "dots", "grid", "diagonal", "waves"] as const).map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))} />
        {design.pattern !== "none" && (
          <div className="grid grid-cols-2 gap-3">
            <ColorInput label="Pattern colour" value={design.patternColor} onChange={(v) => set("patternColor", v)} />
            <ColorInput label="Card colour" value={design.canvasBg} onChange={(v) => set("canvasBg", v)} />
          </div>
        )}
        <p className="hint">Patterns sit around the QR — the code itself keeps a solid background so it stays scannable.</p>
      </Section>

      <Section title="Advanced">
        <Field label="Error correction" hint="Higher levels survive damage and logos but make the code denser.">
          <Select value={design.ecc} onChange={(e) => set("ecc", e.target.value as QrDesign["ecc"])}>
            <option value="L">L — 7% (smallest)</option>
            <option value="M">M — 15% (recommended)</option>
            <option value="Q">Q — 25%</option>
            <option value="H">H — 30% (best with logos)</option>
          </Select>
        </Field>
        <Field label={`Quiet zone (margin): ${design.margin} modules`} hint="Scanners need empty space around the code. 4 is the standard.">
          <input type="range" min={0} max={8} value={design.margin} onChange={(e) => set("margin", +e.target.value)} className="w-full accent-[hsl(var(--brand))]" />
        </Field>
      </Section>
    </div>
  );
}

function EyeChip({ kind, active, onClick, outer }: { kind: string; active: boolean; onClick: () => void; outer?: boolean }) {
  const shape = (s: number, o: number) => {
    const r = { square: 0, rounded: s * 0.3, circle: s / 2, leaf: s * 0.42 }[kind] ?? 0;
    if (kind === "leaf") return <path d={`M${o + r},${o}H${o + s}V${o + s - r}A${r},${r} 0 0 1 ${o + s - r},${o + s}H${o}V${o + r}A${r},${r} 0 0 1 ${o + r},${o}Z`} />;
    return <rect x={o} y={o} width={s} height={s} rx={r} />;
  };
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={`${kind} eye ${outer ? "frame" : "centre"}`}
      className={cn("grid aspect-square place-items-center rounded-xl border p-2 transition", active ? "border-brand bg-brand/5 text-brand ring-2 ring-brand/20" : "border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300")}>
      <svg viewBox="0 0 28 28" className="h-full w-full" fill="currentColor">
        {outer ? (
          <g fillRule="evenodd">
            <g>{shape(28, 0)}</g>
            <g fill="white" className="dark:fill-slate-900">{shape(20, 4)}</g>
            <g opacity=".35">{shape(12, 8)}</g>
          </g>
        ) : (
          <>
            <g opacity=".25">{shape(28, 0)}</g>
            <g fill="white" className="dark:fill-slate-900">{shape(20, 4)}</g>
            <g>{shape(12, 8)}</g>
          </>
        )}
      </svg>
    </button>
  );
}
