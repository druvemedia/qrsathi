"use client";
/**
 * Scan history kept on this device only (localStorage). Camera scanning never
 * writes to the server — nothing about what a user scans leaves the browser
 * unless they look up a product in their own inventory.
 */
import type { ScanKind } from "./scan-classify";

export interface HistoryEntry {
  id: string;
  text: string;
  format: string;
  formatLabel: string;
  kind: ScanKind;
  source: "camera" | "image";
  at: number;
}

const KEY = "qrsathi:scans:v2";
const LEGACY = "qrsathi:scans:v1";
const MAX = 500;
const listeners = new Set<() => void>();

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    const old = JSON.parse(localStorage.getItem(LEGACY) || "[]") as { text: string; at: number }[];
    return old.map((o, i) => ({ id: `${o.at}-${i}`, text: o.text, format: "QRCode", formatLabel: "QR Code", kind: "text", source: "camera", at: o.at }));
  } catch {
    return [];
  }
}

function save(list: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {}
  listeners.forEach((l) => l());
}

export function addHistory(e: Omit<HistoryEntry, "id" | "at">) {
  const list = loadHistory();
  // Collapse rapid repeats of the same code (continuous camera scanning).
  if (list[0] && list[0].text === e.text && Date.now() - list[0].at < 4000) return;
  save([{ ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() }, ...list]);
}
export function removeHistory(id: string) {
  save(loadHistory().filter((h) => h.id !== id));
}
export function clearHistory() {
  save([]);
}
export function onHistoryChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const cell = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function historyToCsv(list: HistoryEntry[]) {
  return ["timestamp,format,type,source,content", ...list.map((h) => [new Date(h.at).toISOString(), h.formatLabel, h.kind, h.source, h.text].map(cell).join(","))].join("\n");
}
