/**
 * Built-in centre logos as small SVG data URLs. They are simple generic
 * glyphs (not official brand artwork); users can upload their own logo.
 */
const svg = (inner: string, bg: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/>${inner}</svg>`;

const W = 'fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"';

const RAW: Record<string, { label: string; svg: string }> = {
  link: { label: "Link", svg: svg(`<path ${W} d="M27 37l10-10M24 31l-4 4a7 7 0 0 0 10 10l4-4M40 33l4-4a7 7 0 0 0-10-10l-4 4"/>`, "#4f46e5") },
  rupee: { label: "Rupee", svg: svg(`<path ${W} d="M21 18h22M21 27h22M27 18c11 0 11 18 0 18h-6l17 13"/>`, "#ea580c") },
  bank: { label: "Bank", svg: svg(`<path ${W} d="M16 26l16-9 16 9M19 30v13M27 30v13M37 30v13M45 30v13M15 47h34"/>`, "#0f766e") },
  whatsapp: { label: "Chat (green)", svg: svg(`<path ${W} d="M18 46l2.5-7A15 15 0 1 1 26 44.5z"/><path fill="#fff" d="M26 25c1-2 3-2 3.5-.5l1.2 3c.3.8-.4 1.6-1 2.2 1 2 2.6 3.6 4.6 4.6.6-.6 1.4-1.3 2.2-1l3 1.2c1.5.5 1.5 2.5-.5 3.5-4 2-15-9-13-13z"/>`, "#16a34a") },
  instagram: { label: "Camera (gradient)", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset=".5" stop-color="#e11d48"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#ig)"/><rect x="16" y="16" width="32" height="32" rx="10" ${W}/><circle cx="32" cy="32" r="7.5" ${W}/><circle cx="41.5" cy="22.5" r="2.4" fill="#fff"/></svg>` },
  facebook: { label: "f (blue)", svg: svg(`<path fill="#fff" d="M35 52V35h6l1-7h-7v-4c0-2 .7-3.5 3.6-3.5H42v-6.2c-.7-.1-3-.3-5.6-.3-5.6 0-9.4 3.4-9.4 9.6V28h-6v7h6v17z"/>`, "#2563eb") },
  youtube: { label: "Play (red)", svg: svg(`<rect x="12" y="19" width="40" height="27" rx="8" fill="#fff"/><path fill="#dc2626" d="M28 26l11 6.5L28 39z"/>`, "#dc2626") },
  linkedin: { label: "in (blue)", svg: svg(`<rect x="17" y="27" width="6" height="19" fill="#fff"/><circle cx="20" cy="19.5" r="3.6" fill="#fff"/><path fill="#fff" d="M28 27h6v3c1-2 3.5-3.6 7-3.6 5.4 0 7 3.5 7 8.5V46h-6v-9.5c0-2.6-.6-4.6-3.2-4.6-2.7 0-4.8 1.8-4.8 5V46h-6z"/>`, "#0a66c2") },
  wifi: { label: "Wi-Fi", svg: svg(`<path ${W} d="M14 27a26 26 0 0 1 36 0M20 34a17 17 0 0 1 24 0M26 41a8 8 0 0 1 12 0"/><circle cx="32" cy="47" r="3" fill="#fff"/>`, "#0284c7") },
  mail: { label: "Email", svg: svg(`<rect x="14" y="19" width="36" height="26" rx="4" ${W}/><path ${W} d="M15 21l17 13 17-13"/>`, "#7c3aed") },
  phone: { label: "Phone", svg: svg(`<path fill="#fff" d="M24 15c2-1 4-.5 5 1.5l3 6c.8 1.6.3 3.4-1 4.5l-2.5 2a24 24 0 0 0 7.5 7.5l2-2.5c1.1-1.3 2.9-1.8 4.5-1l6 3c2 1 2.5 3 1.5 5l-2 3.5c-1.5 2.6-4.6 3.7-7.4 2.6A40 40 0 0 1 18.9 25.4c-1.1-2.8 0-5.9 2.6-7.4z"/>`, "#16a34a") },
  pin: { label: "Map pin", svg: svg(`<path fill="#fff" d="M32 12a14 14 0 0 0-14 14c0 10 14 26 14 26s14-16 14-26a14 14 0 0 0-14-14z"/><circle cx="32" cy="26" r="5.5" fill="#dc2626"/>`, "#dc2626") },
  user: { label: "Contact", svg: svg(`<circle cx="32" cy="25" r="8" ${W}/><path ${W} d="M18 48c2-8 8-11 14-11s12 3 14 11"/>`, "#0f172a") },
  calendar: { label: "Calendar", svg: svg(`<rect x="15" y="18" width="34" height="30" rx="5" ${W}/><path ${W} d="M15 28h34M24 14v8M40 14v8"/>`, "#db2777") },
  file: { label: "Document", svg: svg(`<path ${W} d="M22 13h14l9 9v29H22zM36 13v9h9M27 33h12M27 40h12"/>`, "#e11d48") },
  menu: { label: "Menu", svg: svg(`<path ${W} d="M22 14v14a5 5 0 0 0 10 0V14M27 14v36M42 14c-4 2-5 8-5 14h5v22"/>`, "#ea580c") },
  store: { label: "Store", svg: svg(`<path ${W} d="M14 26l4-11h28l4 11M14 26c0 4 3 6 6 6s6-2 6-6c0 4 3 6 6 6s6-2 6-6c0 4 3 6 6 6s6-2 6-6M18 32v17h28V32M28 49V39h8v10"/>`, "#0f766e") },
  star: { label: "Star", svg: svg(`<path fill="#fff" d="M32 13l5.6 11.6 12.7 1.8-9.2 8.9 2.2 12.6L32 41.9l-11.3 6 2.2-12.6-9.2-8.9 12.7-1.8z"/>`, "#f59e0b") },
  gift: { label: "Offer", svg: svg(`<path ${W} d="M15 27h34v8H15zM18 35v14h28V35M32 27v22M32 27c-3-8-12-9-12-3 0 3 6 3 12 3 6 0 12 0 12-3 0-6-9-5-12 3"/>`, "#db2777") },
  scan: { label: "Scan", svg: svg(`<path ${W} d="M16 24v-8h8M40 16h8v8M48 40v8h-8M24 48h-8v-8M16 32h32"/>`, "#111827") },
};

export const BUILTIN_LOGOS = Object.entries(RAW).map(([id, v]) => ({
  id,
  label: v.label,
  dataUrl: `data:image/svg+xml;base64,${typeof window === "undefined" ? Buffer.from(v.svg).toString("base64") : btoa(v.svg)}`,
}));

export function builtinLogo(id: string | undefined) {
  return BUILTIN_LOGOS.find((l) => l.id === id)?.dataUrl ?? null;
}
