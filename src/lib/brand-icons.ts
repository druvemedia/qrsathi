/**
 * Official brand marks for social destinations, from simple-icons (CC0-1.0).
 * Isomorphic: plain path data (24×24 viewBox), no React. Only the icons named
 * here are imported, so the rest of the package is tree-shaken away.
 *
 * Brand names and logos are trademarks of their owners. They identify where a
 * QR code leads; they don't imply endorsement.
 */
import {
  siFacebook, siGithub, siGooglemaps, siInstagram, siPinterest, siSnapchat, siSpotify, siTelegram,
  siThreads, siTiktok, siWhatsapp, siX, siYoutube,
} from "simple-icons";

export interface BrandMark {
  title: string;
  /** Official brand colour, #rrggbb. */
  hex: string;
  path: string;
}

// simple-icons ships no LinkedIn mark (removed at the owner's request), so a
// plain "in" glyph is drawn here instead.
const LINKEDIN_PATH =
  "M3 1.5h18A1.5 1.5 0 0 1 22.5 3v18a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 21V3A1.5 1.5 0 0 1 3 1.5zM5.4 9.3v9.3h2.9V9.3zm1.45-4.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM10.2 9.3v9.3h2.9v-4.6c0-1.2.25-2.4 1.75-2.4s1.5 1.4 1.5 2.5v4.5h2.9v-5.1c0-2.5-.55-4.4-3.45-4.4-1.4 0-2.35.75-2.7 1.5V9.3z";

const pick = (i: { title: string; hex: string; path: string }): BrandMark => ({ title: i.title, hex: `#${i.hex}`, path: i.path });

export const BRAND_MARKS = {
  instagram: pick(siInstagram),
  facebook: pick(siFacebook),
  whatsapp: pick(siWhatsapp),
  youtube: pick(siYoutube),
  linkedin: { title: "LinkedIn", hex: "#0A66C2", path: LINKEDIN_PATH },
  tiktok: pick(siTiktok),
  x: pick(siX),
  telegram: pick(siTelegram),
  snapchat: pick(siSnapchat),
  spotify: pick(siSpotify),
  maps: pick(siGooglemaps),
  threads: pick(siThreads),
  pinterest: pick(siPinterest),
  github: pick(siGithub),
} satisfies Record<string, BrandMark>;

export type BrandId = keyof typeof BRAND_MARKS;

export function brandMark(id: string | undefined | null): BrandMark | null {
  return id && id in BRAND_MARKS ? BRAND_MARKS[id as BrandId] : null;
}

/** Brands whose mark is near-black need a light variant on dark surfaces. */
export function isDarkMark(m: BrandMark) {
  const n = parseInt(m.hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 60;
}
