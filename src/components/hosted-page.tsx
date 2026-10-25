"use client";
/**
 * Presentational renderer for hosted landing pages (multi-link, menu,
 * business profile, coupon, product, app, feedback, custom landing). Used by
 * the public /p/[code] route and the in-editor preview. All user content is
 * rendered as text; links are restricted to validated http(s) URLs.
 */
import { useEffect, useState } from "react";
import { Check, Clock, Copy, Globe, Mail, MapPin, MessageCircle, Phone, Star } from "lucide-react";

const safe = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : undefined);
const tel = (p: string) => p.replace(/[^\d+]/g, "");

function Shell({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50 text-slate-900" style={{ ["--c" as any]: color }}>
      <div className="h-36 w-full" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }} />
      <div className="mx-auto -mt-24 max-w-md px-4 pb-10">{children}</div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white p-6 shadow-xl shadow-slate-900/5 ${className}`}>{children}</div>;
}

function Btn({ href, children, primary, color }: { href?: string; children: React.ReactNode; primary?: boolean; color: string }) {
  if (!href) return null;
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer nofollow"
      className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition active:scale-[.98]"
      style={primary ? { background: color, color: "#fff" } : { background: "#f1f5f9", color: "#0f172a" }}>
      {children}
    </a>
  );
}

function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{p}</p>)}</>;
}

export function HostedPage({ type, content: c, preview = false }: { type: string; content: Record<string, any>; preview?: boolean }) {
  const color = /^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : "#4f46e5";
  switch (type) {
    case "links":
      return (
        <Shell color={color}>
          <Card className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {safe(c.avatarUrl) ? <img src={safe(c.avatarUrl)} alt="" className="mx-auto -mt-16 h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg" /> :
              <div className="mx-auto -mt-16 grid h-24 w-24 place-items-center rounded-full border-4 border-white text-3xl font-bold text-white shadow-lg" style={{ background: color }}>{(c.title || "?")[0]}</div>}
            <h1 className="mt-3 text-2xl font-bold">{c.title}</h1>
            {c.bio && <p className="mt-1 text-sm text-slate-500">{c.bio}</p>}
            <div className="mt-6 space-y-3">
              {(c.links || []).filter((l: any) => safe(l.url)).map((l: any, i: number) => <Btn key={i} href={safe(l.url)} color={color} primary={i === 0}>{l.label}</Btn>)}
            </div>
          </Card>
        </Shell>
      );
    case "menu": {
      const items = (c.items || []).filter((i: any) => i.name);
      const groups = items.reduce((m: Record<string, any[]>, i: any) => ((m[i.category || "Menu"] ||= []).push(i), m), {});
      return (
        <Shell color={color}>
          <Card className="text-center">
            <h1 className="text-2xl font-bold">{c.restaurant}</h1>
            {c.tagline && <p className="mt-1 text-sm text-slate-500">{c.tagline}</p>}
          </Card>
          {Object.entries(groups).map(([cat, list]) => (
            <Card key={cat} className="mt-4">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color }}>{cat}</h2>
              <ul className="divide-y divide-slate-100">
                {(list as any[]).map((i, k) => (
                  <li key={k} className="flex items-start justify-between gap-4 py-3">
                    <div><p className="font-semibold">{i.name}</p>{i.description && <p className="text-sm text-slate-500">{i.description}</p>}</div>
                    {i.price && <p className="shrink-0 font-semibold">₹{i.price}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </Shell>
      );
    }
    case "business":
      return (
        <Shell color={color}>
          <Card className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {safe(c.logoUrl) && <img src={safe(c.logoUrl)} alt="" className="mx-auto -mt-16 h-24 w-24 rounded-2xl border-4 border-white bg-white object-contain shadow-lg" />}
            <h1 className="mt-3 text-2xl font-bold">{c.name}</h1>
            {c.tagline && <p className="mt-1 text-sm text-slate-500">{c.tagline}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {c.phone && <Btn href={`tel:${tel(c.phone)}`} color={color} primary><Phone className="h-4 w-4" /> Call</Btn>}
              {c.whatsapp && <Btn href={`https://wa.me/${tel(c.whatsapp).replace("+", "")}`} color={color}><MessageCircle className="h-4 w-4" /> WhatsApp</Btn>}
              {c.email && <Btn href={`mailto:${c.email}`} color={color}><Mail className="h-4 w-4" /> Email</Btn>}
              {safe(c.website) && <Btn href={safe(c.website)} color={color}><Globe className="h-4 w-4" /> Website</Btn>}
            </div>
          </Card>
          {c.description && <Card className="mt-4 space-y-3"><Paragraphs text={c.description} /></Card>}
          {(c.address || c.hours) && (
            <Card className="mt-4 space-y-4 text-sm">
              {c.address && <div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} /><div><p className="whitespace-pre-line">{c.address}</p>
                <a className="mt-1 inline-block font-semibold" style={{ color }} target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}>Open in Maps →</a></div></div>}
              {c.hours && <div className="flex gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} /><p className="whitespace-pre-line">{c.hours}</p></div>}
            </Card>
          )}
        </Shell>
      );
    case "coupon":
      return <Coupon c={c} color={color} />;
    case "landing":
      return (
        <Shell color={color}>
          <Card>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {safe(c.imageUrl) && <img src={safe(c.imageUrl)} alt="" className="-mx-6 -mt-6 mb-5 aspect-video w-[calc(100%+3rem)] max-w-none rounded-t-3xl object-cover" />}
            <h1 className="text-2xl font-bold leading-tight">{c.title}</h1>
            {c.subtitle && <p className="mt-2 text-slate-500">{c.subtitle}</p>}
            {c.body && <div className="mt-4 space-y-3"><Paragraphs text={c.body} /></div>}
            {c.ctaLabel && <div className="mt-6"><Btn href={safe(c.ctaUrl)} color={color} primary>{c.ctaLabel}</Btn></div>}
          </Card>
        </Shell>
      );
    case "product":
      return (
        <Shell color={"#0f172a"}>
          <Card>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {safe(c.imageUrl) && <img src={safe(c.imageUrl)} alt="" className="-mx-6 -mt-6 mb-5 aspect-square w-[calc(100%+3rem)] max-w-none rounded-t-3xl object-cover" />}
            <h1 className="text-2xl font-bold">{c.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
              {c.price && <span className="text-xl font-bold text-slate-900">₹{c.price}</span>}
              {c.sku && <span>SKU: {c.sku}</span>}
            </div>
            {c.description && <div className="mt-4 space-y-3"><Paragraphs text={c.description} /></div>}
            {safe(c.buyUrl) && <div className="mt-6"><Btn href={safe(c.buyUrl)} color="#0f172a" primary>Buy / learn more</Btn></div>}
          </Card>
        </Shell>
      );
    case "app":
      return <AppPage c={c} preview={preview} />;
    case "feedback":
      return <Feedback c={c} />;
    default:
      return <div className="p-10 text-center text-slate-500">This page type isn&apos;t available.</div>;
  }
}

function Coupon({ c, color }: { c: any; color: string }) {
  const [copied, setCopied] = useState(false);
  const expired = c.validUntil && new Date(c.validUntil + "T23:59:59") < new Date();
  return (
    <Shell color={color}>
      <Card className="text-center">
        <p className="text-sm font-semibold text-slate-500">{c.business}</p>
        <h1 className="mt-2 text-4xl font-extrabold" style={{ color }}>{c.offer}</h1>
        {c.description && <p className="mt-3 text-slate-600">{c.description}</p>}
        {c.code && (
          <button onClick={() => { navigator.clipboard?.writeText(c.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="mx-auto mt-6 flex items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-3 font-mono text-xl font-bold tracking-widest" style={{ borderColor: color }}>
            {c.code} {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5 text-slate-400" />}
          </button>
        )}
        {c.validUntil && <p className={`mt-4 text-sm ${expired ? "font-semibold text-rose-600" : "text-slate-500"}`}>{expired ? "This offer has expired" : `Valid until ${new Date(c.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`}</p>}
        {!expired && safe(c.redeemUrl) && <div className="mt-6"><Btn href={safe(c.redeemUrl)} color={color} primary>Redeem now</Btn></div>}
      </Card>
      {c.terms && <Card className="mt-4"><h2 className="mb-2 text-sm font-bold">Terms & conditions</h2><p className="whitespace-pre-line text-xs leading-relaxed text-slate-500">{c.terms}</p></Card>}
    </Shell>
  );
}

function AppPage({ c, preview }: { c: any; preview: boolean }) {
  const [os, setOs] = useState<"ios" | "android" | "other" | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    const detected = /iphone|ipad|ipod/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "other";
    setOs(detected);
    const target = detected === "ios" ? safe(c.ios) : detected === "android" ? safe(c.android) : undefined;
    // Auto-forward to the matching store only on the real hosted page (not in the editor preview).
    if (target && !preview) {
      const t = setTimeout(() => window.location.assign(target), 900);
      return () => clearTimeout(t);
    }
  }, [c.ios, c.android, preview]);
  return (
    <Shell color="#0f172a">
      <Card className="text-center">
        <h1 className="text-2xl font-bold">{c.appName || "Get the app"}</h1>
        <p className="mt-1 text-sm text-slate-500">{os === "ios" || os === "android" ? "Taking you to the store…" : "Choose your store"}</p>
        <div className="mt-6 space-y-3">
          <Btn href={safe(c.ios)} color="#0f172a" primary={os === "ios"}> App Store (iPhone)</Btn>
          <Btn href={safe(c.android)} color="#0f172a" primary={os === "android"}>▶ Google Play (Android)</Btn>
          <Btn href={safe(c.fallback)} color="#0f172a">Website</Btn>
        </div>
      </Card>
    </Shell>
  );
}

function Feedback({ c }: { c: any }) {
  const [rating, setRating] = useState(0);
  const color = "#f59e0b";
  return (
    <Shell color={color}>
      <Card className="text-center">
        <p className="text-sm font-semibold text-slate-500">{c.business}</p>
        <h1 className="mt-2 text-2xl font-bold">{c.question || "How was your experience?"}</h1>
        <div className="mt-5 flex justify-center gap-1.5" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
              <Star className="h-10 w-10" fill={n <= rating ? color : "none"} stroke={n <= rating ? color : "#cbd5e1"} />
            </button>
          ))}
        </div>
        {rating >= 4 && <div className="mt-6 space-y-2"><p className="text-sm text-slate-600">Thank you! Would you share it publicly?</p><Btn href={safe(c.reviewUrl)} color={color} primary>Write a review</Btn></div>}
        {rating > 0 && rating < 4 && (
          <div className="mt-6 space-y-2">
            <p className="text-sm text-slate-600">Sorry to hear that. Tell us what went wrong so we can fix it.</p>
            {c.feedbackEmail ? <Btn href={`mailto:${c.feedbackEmail}?subject=${encodeURIComponent(`Feedback for ${c.business}`)}`} color={color} primary>Send private feedback</Btn> : <Btn href={safe(c.reviewUrl)} color={color}>Leave a review</Btn>}
          </div>
        )}
      </Card>
    </Shell>
  );
}
