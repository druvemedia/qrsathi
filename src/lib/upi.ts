/**
 * UPI deep-link helpers (NPCI "upi://pay" linking specification).
 *
 * A UPI QR only *requests* a payment: the payer's app shows the payee and
 * amount and the payer authorises it with their own UPI PIN. Scanning a QR
 * never means a payment happened — only a verified provider callback does.
 */

export const VPA_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const AMOUNT_RE = /^\d{1,7}(\.\d{1,2})?$/;

/** Typical per-transaction cap for P2P UPI. Higher P2M limits exist for some categories. */
export const UPI_SOFT_LIMIT = 100000;
export const UPI_HARD_LIMIT = 500000;

export interface UpiParams {
  pa: string; // payee VPA
  pn?: string; // payee name
  am?: string; // amount, 2 decimals
  tn?: string; // transaction note
  mc?: string; // merchant category code
  tr?: string; // transaction reference
  cu?: string; // currency
}

function enc(v: string) {
  return encodeURIComponent(v);
}

export function formatAmount(am: string | number | undefined) {
  if (am === undefined || am === "") return undefined;
  const n = typeof am === "number" ? am : Number(am);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n.toFixed(2);
}

export function buildUpiUri(p: UpiParams) {
  const parts: string[] = [];
  // '@' is left literal in the VPA – some older UPI parsers do not decode %40.
  parts.push(`pa=${enc(p.pa.trim()).replace(/%40/g, "@")}`);
  if (p.pn?.trim()) parts.push(`pn=${enc(p.pn.trim())}`);
  const am = formatAmount(p.am);
  if (am) parts.push(`am=${am}`);
  parts.push(`cu=${p.cu || "INR"}`);
  if (p.tn?.trim()) parts.push(`tn=${enc(p.tn.trim())}`);
  if (p.mc?.trim()) parts.push(`mc=${enc(p.mc.trim())}`);
  if (p.tr?.trim()) parts.push(`tr=${enc(p.tr.trim())}`);
  return `upi://pay?${parts.join("&")}`;
}

export function parseUpiUri(text: string): UpiParams | null {
  const t = text.trim();
  if (!/^upi:\/\/pay\?/i.test(t)) return null;
  const query = t.slice(t.indexOf("?") + 1);
  const sp = new URLSearchParams(query.replace(/\+/g, "%2B"));
  const pa = sp.get("pa") || "";
  if (!pa) return null;
  return {
    pa,
    pn: sp.get("pn") || undefined,
    am: sp.get("am") || undefined,
    tn: sp.get("tn") || undefined,
    mc: sp.get("mc") || undefined,
    tr: sp.get("tr") || undefined,
    cu: sp.get("cu") || undefined,
  };
}

/** NPCI account+IFSC virtual address, accepted by most UPI apps. */
export function bankVpa(account: string, ifsc: string) {
  return `${account.trim()}@${ifsc.trim().toUpperCase()}.ifsc.npci`;
}

export function upiWarnings(p: { am?: string; pa?: string }) {
  const out: string[] = [];
  const n = Number(p.am);
  if (p.am && Number.isFinite(n) && n > UPI_SOFT_LIMIT)
    out.push("Amounts above ₹1,00,000 may be rejected by many payer apps and banks (per-transaction limits).");
  return out;
}
