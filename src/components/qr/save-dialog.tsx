"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import type { QrDesign } from "@/lib/qr-render";
import type { QrTypeDef } from "@/lib/qr-types";
import { getPlan } from "@/lib/plans";
import { api } from "@/lib/fetcher";
import { Alert, Button, Field, Input, Modal, Switch } from "@/components/ui";
import { useApp } from "@/components/providers";

export interface SavedQr {
  id: string;
  name: string;
  payload: string;
  shortCode: string | null;
  isDynamic: boolean;
  isHosted: boolean;
}

export function SaveDialog({ open, onClose, type, content, design, dynamic, hosted, defaultName, onSaved }: {
  open: boolean; onClose: () => void; type: QrTypeDef; content: Record<string, any>; design: QrDesign;
  dynamic: boolean; hosted: boolean; defaultName: string; onSaved: (q: SavedQr) => void;
}) {
  const { user } = useApp();
  const plan = getPlan(user?.plan);
  const [name, setName] = useState(defaultName);
  const [campaign, setCampaign] = useState("");
  const [alias, setAlias] = useState("");
  const [expires, setExpires] = useState("");
  const [track, setTrack] = useState(true);
  const [utmOpen, setUtmOpen] = useState(false);
  const [utm, setUtm] = useState({ source: "qr", medium: "print", campaign: "", term: "", content: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setName(defaultName); }, [open, defaultName]);

  const save = async () => {
    setBusy(true);
    try {
      const { item } = await api<{ item: SavedQr }>("/api/qrcodes", {
        method: "POST",
        json: {
          name: name.trim() || defaultName, type: type.id, content, design, dynamic,
          alias: alias.trim() || undefined,
          expiresAt: expires ? new Date(expires).toISOString() : undefined,
          campaign: campaign.trim(),
          trackScans: track,
          utm: dynamic && !hosted && utmOpen ? utm : undefined,
        },
      });
      toast.success(hosted ? "Page published!" : dynamic ? "Dynamic QR created!" : "Saved to your library");
      onSaved(item);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const title = hosted ? "Publish hosted page" : dynamic ? "Create dynamic QR code" : "Save to library";
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{hosted ? "Publish" : dynamic ? "Create" : "Save"}</Button></>}>
      <div className="space-y-4">
        {(dynamic || hosted) && (
          <Alert tone="info">
            {hosted
              ? "Your page is hosted at a short link on this site. Edit the content any time — the printed QR keeps working."
              : "The QR encodes a short link on this site that redirects to your destination. Change the destination any time without reprinting. Requires this service to stay online."}
          </Alert>
        )}
        <Field label="Name" required><Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Campaign / label" hint="Optional — group QR codes in analytics, e.g. “Diwali flyers”."><Input value={campaign} maxLength={80} onChange={(e) => setCampaign(e.target.value)} /></Field>
        {(dynamic || hosted) && (
          <>
            <Field label={<span className="inline-flex items-center gap-1.5">Custom alias {!plan.customAlias && <Lock className="h-3 w-3" />}</span>}
              hint={plan.customAlias ? "Letters, numbers, - and _. Leave empty for a random code." : <>Available on Pro. <Link className="text-brand underline" href="/pricing">Upgrade</Link></>}>
              <Input value={alias} onChange={(e) => setAlias(e.target.value)} disabled={!plan.customAlias} placeholder="e.g. diwali-sale" />
            </Field>
            <Field label={<span className="inline-flex items-center gap-1.5">Expiry date {!plan.expiry && <Lock className="h-3 w-3" />}</span>} hint={plan.expiry ? "After this, scans show an “expired” page." : "Available on Pro."}>
              <Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} disabled={!plan.expiry} />
            </Field>
            <Switch checked={track} onChange={setTrack} label="Detailed scan analytics"
              description="Device, browser and approximate country. Off = scan counts only. Visitors with Do-Not-Track/GPC are always counted only." />
            {dynamic && !hosted && (
              <div>
                <Switch checked={utmOpen} onChange={setUtmOpen} label="Add UTM campaign parameters" description="Appended to the destination URL for Google Analytics etc." />
                {utmOpen && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {(["source", "medium", "campaign", "term", "content"] as const).map((k) => (
                      <Field key={k} label={`utm_${k}`}><Input value={utm[k]} maxLength={100} onChange={(e) => setUtm({ ...utm, [k]: e.target.value })} /></Field>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
