"use client";
/** Per-device generator defaults chosen in Settings → Defaults (stored in localStorage). */
export interface Preferences {
  qrType: string;
  qrTemplate: string; // id from TEMPLATES, "" = classic default
  barcodeFormat: string;
  labelSize: string;
}
export const DEFAULT_PREFS: Preferences = { qrType: "url", qrTemplate: "", barcodeFormat: "ean13", labelSize: "50x25" };
const KEY = "qrsathi:prefs:v1";

export function loadPrefs(): Preferences {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}
export function savePrefs(p: Preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
