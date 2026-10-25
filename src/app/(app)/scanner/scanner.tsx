"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, BookOpen, Camera, CameraOff, Check, ClipboardPaste, Copy, Download, ExternalLink, Flashlight, FlashlightOff, History,
  ImageUp, IndianRupee, Mail, MessageSquare, Package, PackagePlus, Phone, Repeat, ShieldAlert, ShieldCheck, SwitchCamera, Truck, Wifi, ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { analyzeUpi, analyzeUrl, overall, type SafetyNote } from "@/lib/content-safety";
import { classifyScan, isbn13to10, issnFromEan, KIND_LABELS, type ScanKind } from "@/lib/scan-classify";
import { parseGs1 } from "@/lib/barcodes";
import { SCAN_FILTERS, scanImage, scanImageFile, type ScanFilter, type ScanHit } from "@/lib/zxing-client";
import { MATRIX_FORMATS } from "@/lib/scan-merge";
import { addHistory, loadHistory, onHistoryChange, type HistoryEntry } from "@/lib/scan-history";
import { downloadBlob } from "@/lib/qr-export";
import { api } from "@/lib/fetcher";
import type { ProductDto } from "@/lib/products";
import { Alert, Badge, Button, Card, Modal, Segmented, Select, Spinner, Switch } from "@/components/ui";
import { useApp } from "@/components/providers";
import { cn, truncate } from "@/lib/utils";

export function Scanner() {
  const sp = useSearchParams();
  const [mode, setMode] = useState<"camera" | "image">("camera");
  const [filter, setFilter] = useState<ScanFilter>("all");
  const [hits, setHits] = useState<ScanHit[]>([]);
  const [continuous, setContinuous] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    return onHistoryChange(() => setHistory(loadHistory()));
  }, []);

  const onHits = useCallback((list: ScanHit[], source: "camera" | "image") => {
    if (!list.length) return;
    navigator.vibrate?.(50);
    for (const h of list) addHistory({ text: h.text, format: h.format, formatLabel: h.formatLabel, kind: classifyScan(h.text, h.format, h.contentType), source });
    setHits((prev) => (source === "camera" && continuous ? [...list, ...prev.filter((p) => !list.some((l) => l.text === p.text))].slice(0, 10) : list));
  }, [continuous]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={mode} onChange={(m) => { setMode(m); setHits([]); }} options={[
            { value: "camera", label: <span className="flex items-center gap-1.5"><Camera className="h-4 w-4" /> Camera</span> },
            { value: "image", label: <span className="flex items-center gap-1.5"><ImageUp className="h-4 w-4" /> Image</span> },
          ]} />
          <Select className="w-auto py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as ScanFilter)} aria-label="Formats to detect">
            {SCAN_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
          {mode === "camera" && <Switch checked={continuous} onChange={setContinuous} label="Continuous" description="Keep scanning, list every code" />}
        </div>
        {mode === "camera"
          ? <CameraScanner filter={filter} onHits={(l) => onHits(l, "camera")} paused={!continuous && hits.length > 0} onResume={() => setHits([])} autostart={sp.get("camera") === "1"} />
          : <ImageScanner filter={filter} onHits={(l) => onHits(l, "image")} />}
        <p className="text-xs text-slate-500">Decoding runs entirely in your browser (ZXing WebAssembly). Camera frames and images are never uploaded. History is stored on this device only.</p>
      </div>

      <div className="space-y-4">
        {hits.length > 0 ? (
          <>
            {hits.length > 1 && <p className="text-sm font-semibold">{hits.length} codes detected</p>}
            {hits.map((h, i) => <ResultCard key={`${h.format}-${h.text}-${i}`} hit={h} onClear={() => setHits((l) => l.filter((_, j) => j !== i))} />)}
          </>
        ) : (
          <Card className="p-6 text-center text-sm text-slate-500">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            Scan a QR code or barcode to see what it contains. Nothing opens automatically and scanning never changes your stock.
          </Card>
        )}
        {history.length > 0 && (
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4" /> Recent scans</p>
              <Link href="/scan-history" className="text-xs font-semibold text-brand hover:underline">All history →</Link>
            </div>
            <ul className="space-y-0.5">
              {history.slice(0, 8).map((h) => (
                <li key={h.id}>
                  <button onClick={() => setHits([{ text: h.text, format: h.format, formatLabel: h.formatLabel, contentType: "Text", symbologyIdentifier: "" }])}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
                    <Badge className="shrink-0">{h.formatLabel}</Badge>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{truncate(h.text.replace(/\s+/g, " "), 60)}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{new Date(h.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------- camera ----------------
type CamState = "idle" | "starting" | "live" | "denied" | "insecure" | "unsupported" | "error";

function CameraScanner({ filter, onHits, paused, onResume, autostart }: { filter: ScanFilter; onHits: (h: ScanHit[]) => void; paused: boolean; onResume: () => void; autostart: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const busy = useRef(false);
  const last = useRef(0);
  const prevFrame = useRef<Set<string>>(new Set());
  const live = useRef({ paused, filter, onHits });
  live.current = { paused, filter, onHits };
  const [state, setState] = useState<CamState>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [zoom, setZoom] = useState<{ min: number; max: number; step: number; value: number } | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const tick = useCallback(() => {
    raf.current = requestAnimationFrame(tick);
    const v = video.current, c = canvas.current;
    const now = performance.now();
    if (!v || !c || v.readyState < 2 || live.current.paused || busy.current || now - last.current < 140) return;
    last.current = now;
    const w = Math.min(960, v.videoWidth), h = Math.round((v.videoHeight / v.videoWidth) * w);
    if (!w || !h) return;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(v, 0, 0, w, h);
    busy.current = true;
    scanImage(ctx.getImageData(0, 0, w, h), live.current.filter, { maxSymbols: 4, thorough: false })
      .then((hits) => {
        // 1D barcodes must decode identically in two consecutive frames (guards against single-frame misreads).
        const keys = new Set(hits.map((h) => h.format + "|" + h.text));
        const confirmed = hits.filter((h) => MATRIX_FORMATS.has(h.format) || prevFrame.current.has(h.format + "|" + h.text));
        prevFrame.current = keys;
        if (confirmed.length && !live.current.paused) live.current.onHits(confirmed);
      })
      .catch(() => {})
      .finally(() => { busy.current = false; });
  }, []);

  const start = useCallback(async (opts: { deviceId?: string; facing?: "environment" | "user" } = {}) => {
    if (typeof window !== "undefined" && !window.isSecureContext) return setState("insecure");
    if (!navigator.mediaDevices?.getUserMedia) return setState("unsupported");
    stop();
    setState("starting");
    try {
      const id = opts.deviceId ?? deviceId;
      const s = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } } : { facingMode: { ideal: opts.facing ?? facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      const track = s.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number; step: number } };
      const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
      setTorch({ supported: !!caps.torch, on: false });
      setZoom(caps.zoom ? { ...caps.zoom, value: settings.zoom ?? caps.zoom.min } : null);
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"));
      setState("live");
      // Warm up the decoder while the camera settles.
      raf.current = requestAnimationFrame(tick);
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") setState("denied");
      else { setErrMsg(e?.name === "NotFoundError" ? "No camera was found on this device." : e?.message || "Camera error"); setState("error"); }
    }
  }, [deviceId, facing, stop, tick]);

  useEffect(() => stop, [stop]);
  useEffect(() => { if (autostart) start(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [autostart]);

  const track = () => stream.current?.getVideoTracks()[0];
  const toggleTorch = async () => {
    try {
      await track()?.applyConstraints({ advanced: [{ torch: !torch.on } as any] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch {
      toast.error("Flashlight isn't available on this camera.");
    }
  };
  const applyZoom = async (v: number) => {
    setZoom((z) => (z ? { ...z, value: v } : z));
    try { await track()?.applyConstraints({ advanced: [{ zoom: v } as any] }); } catch {}
  };
  const flip = () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    setDeviceId("");
    start({ facing: next, deviceId: "" });
  };

  const messages: Partial<Record<CamState, [string, string]>> = {
    denied: ["Camera permission denied", "Allow camera access in your browser's site settings, then try again — or switch to Image mode."],
    insecure: ["Camera needs a secure connection", "Browsers only allow camera access on HTTPS or localhost. Open this site over HTTPS, or use Image mode."],
    unsupported: ["Camera not supported", "This browser doesn't support camera access. Try a recent Chrome, Edge, Firefox or Safari, or use Image mode."],
    error: ["Camera unavailable", errMsg],
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] w-full bg-slate-950">
        <video ref={video} className={cn("h-full w-full object-cover", state !== "live" && "hidden", facing === "user" && !deviceId && "-scale-x-100")} playsInline muted />
        <canvas ref={canvas} className="hidden" />
        {state === "live" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-[55%] w-[78%] rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(2,6,23,.45)]">
              <div className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-brand shadow-[0_0_12px_hsl(var(--brand))]" />
            </div>
          </div>
        )}
        {state !== "live" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div>
              {messages[state] ? (
                <><CameraOff className="mx-auto h-10 w-10 text-rose-400" /><p className="mt-3 font-semibold">{messages[state]![0]}</p><p className="mx-auto mt-1 max-w-sm text-sm text-slate-300">{messages[state]![1]}</p></>
              ) : (
                <><Camera className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-3 font-semibold">Scan QR codes & barcodes</p>
                  <p className="mt-1 text-sm text-slate-300">Your browser will ask for camera permission. Video stays on your device.</p></>
              )}
              {state !== "insecure" && state !== "unsupported" && (
                <Button className="mt-4" onClick={() => start()} loading={state === "starting"}>{state === "idle" ? "Allow camera & start" : "Try again"}</Button>
              )}
            </div>
          </div>
        )}
        {paused && state === "live" && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/70">
            <Button onClick={onResume}><Repeat className="h-4 w-4" /> Scan another</Button>
          </div>
        )}
      </div>
      {state === "live" && (
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={flip}><SwitchCamera className="h-4 w-4" /> {facing === "environment" ? "Front camera" : "Rear camera"}</Button>
            {devices.length > 1 && (
              <Select className="w-auto max-w-[220px] py-1.5 text-xs" value={deviceId} onChange={(e) => { setDeviceId(e.target.value); start({ deviceId: e.target.value }); }} aria-label="Camera">
                <option value="">Auto ({facing === "environment" ? "rear" : "front"})</option>
                {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
              </Select>
            )}
            {torch.supported && (
              <Button size="sm" variant={torch.on ? "primary" : "outline"} onClick={toggleTorch} aria-pressed={torch.on}>
                {torch.on ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />} Flash
              </Button>
            )}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { stop(); setState("idle"); }}>Stop</Button>
          </div>
          {zoom && zoom.max > zoom.min && (
            <label className="flex items-center gap-3 text-xs text-slate-500">
              <ZoomIn className="h-4 w-4" /> Zoom
              <input type="range" min={zoom.min} max={zoom.max} step={zoom.step || 0.1} value={zoom.value} onChange={(e) => applyZoom(+e.target.value)} className="flex-1 accent-[hsl(var(--brand))]" />
              <span className="w-10 text-right tabular-nums">{zoom.value.toFixed(1)}×</span>
            </label>
          )}
          {!torch.supported && !zoom && <p className="text-[11px] text-slate-400">Flashlight and zoom appear here when your camera supports them (mostly Chrome on Android).</p>}
        </div>
      )}
    </Card>
  );
}

// ---------------- image ----------------
function ImageScanner({ filter, onHits }: { filter: ScanFilter; onHits: (h: ScanHit[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<{ url: string; w: number; h: number } | null>(null);
  const [found, setFound] = useState<ScanHit[]>([]);
  const [busy, setBusy] = useState(false);

  const scanFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file (PNG, JPG, WEBP…).");
    if (file.size > 25 * 1024 * 1024) return toast.error("Image is larger than 25 MB.");
    setBusy(true);
    setFound([]);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      setPreview((p) => { if (p) URL.revokeObjectURL(p.url); return { url, w: img.naturalWidth, h: img.naturalHeight }; });
      const hits = await scanImageFile(file, filter);
      setFound(hits);
      if (hits.length) {
        onHits(hits);
        toast.success(hits.length === 1 ? `Found ${hits[0].formatLabel}` : `Found ${hits.length} codes`);
      } else {
        toast.error(filter === "all"
          ? "No supported QR code or barcode found. Try a sharper, well-lit image where the code is flat and fills more of the frame."
          : "Nothing found with the selected format filter. Try “All formats”.");
      }
    } catch {
      toast.error("Couldn't read that image file.");
    } finally {
      setBusy(false);
    }
  }, [filter, onHits]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
      if (f) scanFile(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [scanFile]);

  return (
    <Card
      className={cn("grid min-h-[340px] place-items-center border-2 border-dashed p-6 text-center transition", drag ? "border-brand bg-brand/5" : "border-slate-200 dark:border-slate-800")}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) scanFile(f); }}
    >
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) scanFile(f); e.target.value = ""; }} />
      <div className="w-full">
        {preview ? (
          <div className="relative mx-auto mb-4 inline-block max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt="Uploaded" className="max-h-72 rounded-xl" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${preview.w} ${preview.h}`} preserveAspectRatio="none" aria-hidden>
              {found.map((h, i) => h.corners && (
                <polygon key={i} points={h.corners.map((c) => `${c.x},${c.y}`).join(" ")} fill="hsl(var(--brand) / .15)" stroke="hsl(var(--brand))" strokeWidth={Math.max(3, preview.w / 200)} />
              ))}
            </svg>
          </div>
        ) : <ImageUp className="mx-auto h-10 w-10 text-slate-300" />}
        <p className="mt-2 font-semibold">Drop an image, paste a screenshot, or browse</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-500"><ClipboardPaste className="h-3.5 w-3.5" /> Ctrl/⌘ + V works too · multiple codes per image are detected</p>
        <Button className="mt-4" onClick={() => input.current?.click()} loading={busy}>Choose image</Button>
      </div>
    </Card>
  );
}

// ---------------- results ----------------
function RiskBadge({ notes }: { notes: SafetyNote[] }) {
  const r = overall(notes);
  return r === "danger" ? <Badge tone="rose"><ShieldAlert className="h-3 w-3" /> High risk</Badge>
    : r === "caution" ? <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> Check carefully</Badge>
    : <Badge tone="green"><ShieldCheck className="h-3 w-3" /> No obvious issues</Badge>;
}
function Notes({ notes }: { notes: SafetyNote[] }) {
  return <div className="space-y-2">{notes.map((n, i) => (
    <Alert key={i} tone={n.level === "danger" ? "error" : n.level === "caution" ? "warn" : "info"} icon={n.level === "danger" ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}>{n.message}</Alert>
  ))}</div>;
}
function parseWifi(t: string) {
  const get = (k: string) => {
    const m = new RegExp(`(?:^WIFI:|;)${k}:((?:\\\\.|[^;])*)`, "i").exec(t);
    return m ? m[1].replace(/\\(.)/g, "$1") : "";
  };
  return { ssid: get("S"), password: get("P"), security: get("T") || "nopass" };
}

const KIND_ICON: Partial<Record<ScanKind, any>> = { url: ExternalLink, upi: IndianRupee, wifi: Wifi, tel: Phone, sms: MessageSquare, email: Mail, product: Package, isbn: BookOpen, issn: BookOpen, gs1: Package, logistics: Truck };
const LOOKUP_KINDS = new Set<ScanKind>(["product", "isbn", "issn", "gs1", "logistics", "text"]);

function ResultCard({ hit, onClear }: { hit: ScanHit; onClear: () => void }) {
  const text = hit.text;
  const kind = classifyScan(text, hit.format, hit.contentType);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<null | { href: string; label: string; notes: SafetyNote[] }>(null);
  const copy = (v = text) => { navigator.clipboard.writeText(v); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1400); };
  const open = (href: string) => { window.open(href, "_blank", "noopener,noreferrer"); setConfirm(null); };
  const lookupable = LOOKUP_KINDS.has(kind) && text.length <= 200 && !/\s{2,}|\n/.test(text);

  let body: React.ReactNode = null;
  let notes: SafetyNote[] = [];
  const gs1 = parseGs1(text);
  if (kind === "url") {
    const a = analyzeUrl(text);
    notes = a.notes;
    body = (<>
      {a.url && <p className="text-sm">Domain: <strong className="break-all">{a.url.hostname}</strong></p>}
      <p className="mt-1 break-all rounded-lg bg-slate-50 p-2 font-mono text-xs dark:bg-slate-800">{text}</p>
      <div className="mt-3"><Notes notes={notes} /></div>
      <Button className="mt-4 w-full" onClick={() => setConfirm({ href: text, label: "Open this link?", notes })} disabled={!a.url || !/^https?:$/.test(a.url.protocol)}><ExternalLink className="h-4 w-4" /> Open link…</Button>
    </>);
  } else if (kind === "upi") {
    const a = analyzeUpi(text);
    notes = a.notes;
    body = (<>
      {a.upi && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-slate-500">Pay to</dt><dd className="flex items-center gap-2 font-mono">{a.upi.pa}<button onClick={() => copy(a.upi!.pa)} aria-label="Copy UPI ID"><Copy className="h-3.5 w-3.5 text-slate-400" /></button></dd>
          <dt className="text-slate-500">Name</dt><dd>{a.upi.pn || <em className="text-slate-400">not provided</em>}</dd>
          <dt className="text-slate-500">Amount</dt><dd>{a.upi.am ? `₹${a.upi.am}` : "You enter it"}</dd>
          {a.upi.tn && <><dt className="text-slate-500">Note</dt><dd>{a.upi.tn}</dd></>}
        </dl>
      )}
      <div className="mt-3"><Notes notes={notes} /></div>
      {a.upi && overall(notes) !== "danger" && <Button className="mt-4 w-full" onClick={() => setConfirm({ href: text, label: "Open in your UPI app?", notes })}><IndianRupee className="h-4 w-4" /> Open in UPI app…</Button>}
      <p className="mt-2 text-xs text-slate-500">Your UPI app shows the verified payee name. A payment happens only after you approve it with your PIN in that app — scanning is never a payment.</p>
    </>);
  } else if (kind === "wifi") {
    const w = parseWifi(text);
    body = (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-slate-500">Network</dt><dd className="font-semibold">{w.ssid}</dd>
        <dt className="text-slate-500">Security</dt><dd>{w.security === "nopass" ? "Open (no password)" : w.security}</dd>
        {w.password && <><dt className="text-slate-500">Password</dt><dd className="flex items-center gap-2 font-mono">{w.password}<button onClick={() => copy(w.password)} aria-label="Copy password"><Copy className="h-3.5 w-3.5 text-slate-400" /></button></dd></>}
      </dl>
    );
  } else if (kind === "vcard" || kind === "event") {
    const content = kind === "event" && !/BEGIN:VCALENDAR/i.test(text) ? `BEGIN:VCALENDAR\nVERSION:2.0\n${text}\nEND:VCALENDAR` : text;
    body = (<>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">{text}</pre>
      <Button className="mt-3 w-full" variant="outline" onClick={() => downloadBlob(new Blob([content], { type: kind === "vcard" ? "text/vcard" : "text/calendar" }), kind === "vcard" ? "contact.vcf" : "event.ics")}>
        <Download className="h-4 w-4" /> {kind === "vcard" ? "Save contact (.vcf)" : "Add to calendar (.ics)"}
      </Button>
    </>);
  } else if (kind === "tel" || kind === "sms" || kind === "email") {
    const href = kind === "sms" ? text.replace(/^smsto:([^:]*):?(.*)$/i, (_m, n, b) => `sms:${n}${b ? `?body=${encodeURIComponent(b)}` : ""}`) : text;
    body = (<>
      <p className="break-all rounded-lg bg-slate-50 p-2 font-mono text-xs dark:bg-slate-800">{text}</p>
      <Button className="mt-3 w-full" variant="outline" onClick={() => setConfirm({ href, label: kind === "tel" ? "Call this number?" : kind === "sms" ? "Open SMS app?" : "Compose this email?", notes: [] })}>
        {kind === "tel" ? <Phone className="h-4 w-4" /> : kind === "sms" ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />} {kind === "tel" ? "Call…" : kind === "sms" ? "Send SMS…" : "Write email…"}
      </Button>
    </>);
  } else if (gs1) {
    body = (
      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm dark:divide-slate-800 dark:border-slate-800">
        {gs1.map((p, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr] gap-3 px-3 py-1.5"><dt className="text-slate-500">({p.ai}) {p.name}</dt><dd className="break-all text-right font-mono">{/^1[1-7]$/.test(p.ai) && /^\d{6}$/.test(p.value) ? `${p.value.slice(4)}-${p.value.slice(2, 4)}-20${p.value.slice(0, 2)}` : p.value}</dd></div>
        ))}
      </dl>
    );
  } else if (kind === "isbn" || kind === "issn" || kind === "product" || kind === "logistics") {
    const extra = kind === "isbn" ? (isbn13to10(text) ? `ISBN-10: ${isbn13to10(text)}` : "ISBN-13") : kind === "issn" ? `ISSN ${issnFromEan(text)}` : kind === "logistics" ? "GTIN-14 for a carton / trade-item case" : null;
    body = (<>
      <p className="rounded-lg bg-slate-50 p-3 text-center font-mono text-2xl tracking-wider dark:bg-slate-800">{text}</p>
      {extra && <p className="mt-2 text-center text-sm text-slate-500">{extra}</p>}
    </>);
  } else {
    body = <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">{text}</p>;
  }

  const Icon = KIND_ICON[kind] || Check;
  return (
    <Card className="animate-scale-in p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand"><Icon className="h-4 w-4" /></span>
          <div><p className="text-xs text-slate-500">{hit.formatLabel}</p><p className="font-display font-bold">{KIND_LABELS[kind]}</p></div>
        </div>
        {(kind === "url" || kind === "upi") && <RiskBadge notes={notes} />}
      </div>
      {body}
      {lookupable && <ProductLookup code={text} format={hit.format} />}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => copy()}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy</Button>
        <Button variant="outline" size="sm" onClick={() => downloadBlob(new Blob([`Format: ${hit.formatLabel}\nType: ${KIND_LABELS[kind]}\nScanned: ${new Date().toISOString()}\n\n${text}\n`], { type: "text/plain" }), "scan-result.txt")}><Download className="h-4 w-4" /> Download</Button>
        <Button variant="ghost" size="sm" onClick={onClear}>Dismiss</Button>
      </div>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.label || ""} size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant={confirm && overall(confirm.notes) !== "safe" ? "danger" : "primary"} onClick={() => confirm && open(confirm.href)}>{confirm && overall(confirm.notes) !== "safe" ? "Open anyway" : "Open"}</Button></>}>
        <p className="break-all font-mono text-xs">{confirm?.href}</p>
        {confirm && confirm.notes.length > 0 && <div className="mt-3"><Notes notes={confirm.notes} /></div>}
      </Modal>
    </Card>
  );
}

/** Read-only lookup in the signed-in user's inventory. Never changes stock. */
function ProductLookup({ code, format }: { code: string; format: string }) {
  const { user } = useApp();
  const [state, setState] = useState<{ loading: boolean; item?: ProductDto | null; error?: string }>({ loading: !!user });
  useEffect(() => {
    if (!user) return;
    let off = false;
    setState({ loading: true });
    api<{ found: boolean; item?: ProductDto }>(`/api/products/lookup?code=${encodeURIComponent(code)}&format=${encodeURIComponent(format)}`)
      .then((r) => !off && setState({ loading: false, item: r.found ? r.item! : null }))
      .catch((e) => !off && setState({ loading: false, error: e.message }));
    return () => { off = true; };
  }, [code, format, user]);

  if (!user) return <p className="mt-3 text-xs text-slate-500"><Link href="/login?next=/scanner" className="font-semibold text-brand">Sign in</Link> to match barcodes against your product inventory.</p>;
  if (state.loading) return <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Spinner className="h-4 w-4" /> Looking up your inventory…</div>;
  if (state.error) return <p className="mt-3 text-xs text-rose-600">{state.error}</p>;
  const p = state.item;
  if (!p) return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-3 text-sm dark:border-slate-700">
      <p className="text-slate-600 dark:text-slate-300">Not in your inventory.</p>
      <Link href={`/products/new?barcode=${encodeURIComponent(code)}&format=${encodeURIComponent(format)}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><PackagePlus className="h-4 w-4" /> Register as a new product</Link>
    </div>
  );
  const price = new Intl.NumberFormat("en-IN", { style: "currency", currency: p.currency }).format(p.priceMinor / 100);
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-white object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-white text-slate-400 dark:bg-slate-900"><Package className="h-6 w-6" /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/products/${p.id}`} className="font-semibold hover:text-brand">{p.name}</Link>
            {p.status === "archived" ? <Badge tone="slate">Archived</Badge> : p.lowStock ? <Badge tone="amber">Low stock</Badge> : <Badge tone="green">In stock</Badge>}
          </div>
          <p className="text-xs text-slate-500">SKU {p.sku}{p.category && ` · ${p.category}`}{p.variant && ` · ${p.variant}`}</p>
          <div className="mt-1 flex gap-4 text-sm"><span className="font-semibold">{price}</span><span>Stock: <strong>{p.stock}</strong></span></div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/products/${p.id}?stock=in`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Stock in…</Link>
        <Link href={`/products/${p.id}?stock=out`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Stock out…</Link>
        <Link href={`/products/${p.id}`} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand">View product →</Link>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Scanning doesn&apos;t change stock — use Stock in/out to record movements.</p>
    </div>
  );
}

