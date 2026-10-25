/** Print-ready poster / payment standee composed around a rendered QR. */
import type { RenderResult } from "./qr-render";
import { escapeXml } from "./utils";

export interface PosterTheme {
  id: string;
  name: string;
  primary: string;
  primaryText: string;
  bg: string;
  text: string;
  muted: string;
}

export const POSTER_THEMES: PosterTheme[] = [
  { id: "indigo", name: "Indigo", primary: "#4338ca", primaryText: "#ffffff", bg: "#ffffff", text: "#0f172a", muted: "#64748b" },
  { id: "saffron", name: "Saffron", primary: "#ea580c", primaryText: "#ffffff", bg: "#fffaf5", text: "#1c1917", muted: "#78716c" },
  { id: "emerald", name: "Emerald", primary: "#047857", primaryText: "#ffffff", bg: "#f8fffb", text: "#052e16", muted: "#4b5563" },
  { id: "midnight", name: "Midnight", primary: "#0f172a", primaryText: "#f8fafc", bg: "#ffffff", text: "#0f172a", muted: "#475569" },
  { id: "rose", name: "Rose", primary: "#be123c", primaryText: "#ffffff", bg: "#fff7f8", text: "#1f2937", muted: "#6b7280" },
];

export interface PosterContent {
  headline: string; // e.g. "SCAN & PAY"
  title: string; // merchant / business name
  subtitle?: string;
  highlight?: string; // e.g. "₹ 250.00"
  detail?: string; // e.g. "UPI ID: shop@okaxis"
  footer?: string; // e.g. "Accepted on all UPI apps"
  disclaimer?: string;
}

const FONT = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function fit(text: string, fs: number, maxW: number) {
  const est = text.length * fs * 0.6;
  return est > maxW ? maxW / (text.length * 0.6) : fs;
}

/** A5/A4 portrait ratio (1 : √2), 1000 × 1414 units. */
export function renderPosterSvg(qr: RenderResult, c: PosterContent, theme: PosterTheme) {
  const W = 1000, H = 1414;
  const t = (s: string, x: number, y: number, fs: number, color: string, weight = 700, maxW = 860) =>
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${fit(s, fs, maxW).toFixed(1)}" font-weight="${weight}" fill="${color}" text-anchor="middle" dominant-baseline="central">${escapeXml(s)}</text>`;

  const qrBox = 600;
  const scale = qrBox / Math.max(qr.width, qr.height);
  const qrW = qr.width * scale, qrH = qr.height * scale;
  const cardY = 400;
  const cardH = qrH + 80;

  let y = cardY + cardH + 60;
  const lower: string[] = [];
  if (c.highlight) {
    lower.push(
      `<rect x="${W / 2 - 200}" y="${y - 40}" width="400" height="80" rx="40" fill="${theme.primary}" opacity="0.1"/>`,
      t(c.highlight, W / 2, y, 46, theme.primary, 800, 380),
    );
    y += 90;
  }
  if (c.detail) {
    lower.push(t(c.detail, W / 2, y, 30, theme.text, 600));
    y += 56;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${theme.bg}"/>
<path d="M0,0H${W}V250Q${W / 2},330 0,250Z" fill="${theme.primary}"/>
<circle cx="900" cy="60" r="120" fill="${theme.primaryText}" opacity="0.07"/>
<circle cx="80" cy="220" r="70" fill="${theme.primaryText}" opacity="0.06"/>
${t(c.headline.toUpperCase(), W / 2, 120, 84, theme.primaryText, 800)}
${c.subtitle ? t(c.subtitle, W / 2, 205, 32, theme.primaryText, 500) : ""}
${t(c.title, W / 2, 340, 54, theme.text, 800)}
<rect x="${(W - qrW) / 2 - 40}" y="${cardY}" width="${qrW + 80}" height="${cardH}" rx="36" fill="#ffffff" stroke="${theme.primary}" stroke-opacity="0.25" stroke-width="4"/>
<g transform="translate(${((W - qrW) / 2).toFixed(1)},${cardY + 40}) scale(${scale.toFixed(4)})">${qr.body}</g>
${lower.join("\n")}
${c.footer ? `<rect x="0" y="${H - 170}" width="${W}" height="170" fill="${theme.primary}"/>${t(c.footer, W / 2, H - 112, 34, theme.primaryText, 700)}` : ""}
${c.disclaimer ? t(c.disclaimer, W / 2, H - 55, 22, theme.primaryText, 400, 900) : ""}
</svg>`;
}
