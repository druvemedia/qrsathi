import type { QrDesign } from "./qr-render";

export interface DesignTemplate {
  id: string;
  name: string;
  design: Partial<QrDesign>;
}

export const TEMPLATES: DesignTemplate[] = [
  { id: "classic", name: "Classic", design: { fg: "#111827", bg: "#ffffff", moduleStyle: "square", eyeOuter: "square", eyeInner: "square", frame: "none", gradient: { enabled: false, type: "linear", from: "#111827", to: "#111827", rotation: 0 }, eyeColor: "", pattern: "none" } },
  { id: "scan-me", name: "Scan Me", design: { fg: "#1e1b4b", bg: "#ffffff", moduleStyle: "rounded", eyeOuter: "rounded", eyeInner: "rounded", frame: "banner", frameColor: "#4f46e5", frameText: "SCAN ME", frameTextColor: "#ffffff", canvasBg: "#ffffff", gradient: { enabled: false, type: "linear", from: "#4f46e5", to: "#4f46e5", rotation: 0 }, eyeColor: "#4f46e5", pattern: "none" } },
  { id: "pay-here", name: "Pay Here", design: { fg: "#1c1917", bg: "#ffffff", moduleStyle: "fluid", eyeOuter: "rounded", eyeInner: "circle", frame: "badge", frameColor: "#ea580c", frameText: "PAY HERE", frameTextColor: "#ffffff", canvasBg: "#ffffff", eyeColor: "#c2410c", gradient: { enabled: false, type: "linear", from: "#000", to: "#000", rotation: 0 }, pattern: "none" } },
  { id: "aurora", name: "Aurora", design: { moduleStyle: "dots", eyeOuter: "circle", eyeInner: "circle", gradient: { enabled: true, type: "linear", from: "#4338ca", to: "#be185d", rotation: 45 }, eyeColor: "", bg: "#ffffff", frame: "bubble", frameColor: "#4338ca", frameText: "SCAN ME", frameTextColor: "#ffffff", canvasBg: "#ffffff", pattern: "none" } },
  { id: "ocean", name: "Ocean", design: { moduleStyle: "fluid", eyeOuter: "leaf", eyeInner: "leaf", gradient: { enabled: true, type: "radial", from: "#0c4a6e", to: "#0e7490", rotation: 0 }, eyeColor: "#0c4a6e", bg: "#ffffff", frame: "outline", frameColor: "#0e7490", frameText: "SCAN TO VISIT", canvasBg: "#f0fdff", pattern: "waves", patternColor: "#0e7490" } },
  { id: "follow", name: "Follow Us", design: { moduleStyle: "rounded", eyeOuter: "rounded", eyeInner: "rounded", gradient: { enabled: true, type: "linear", from: "#9d174d", to: "#6d28d9", rotation: 120 }, eyeColor: "", bg: "#ffffff", frame: "banner-top", frameColor: "#be185d", frameText: "FOLLOW US", frameTextColor: "#ffffff", canvasBg: "#ffffff", pattern: "none" } },
  { id: "forest", name: "Forest", design: { fg: "#064e3b", bg: "#ffffff", moduleStyle: "bars", eyeOuter: "rounded", eyeInner: "square", eyeColor: "#047857", frame: "badge", frameColor: "#064e3b", frameText: "SCAN ME", frameTextColor: "#ecfdf5", canvasBg: "#ffffff", gradient: { enabled: false, type: "linear", from: "#000", to: "#000", rotation: 0 }, pattern: "none" } },
  { id: "midnight", name: "Midnight", design: { fg: "#020617", bg: "#ffffff", moduleStyle: "diamond", eyeOuter: "circle", eyeInner: "circle", eyeColor: "#020617", frame: "badge", frameColor: "#020617", frameText: "SCAN ME", frameTextColor: "#f8fafc", canvasBg: "#ffffff", gradient: { enabled: false, type: "linear", from: "#000", to: "#000", rotation: 0 }, pattern: "none" } },
  { id: "festive", name: "Festive", design: { fg: "#7c2d12", bg: "#ffffff", moduleStyle: "fluid", eyeOuter: "leaf", eyeInner: "circle", eyeColor: "#b91c1c", frame: "banner", frameColor: "#b45309", frameText: "SPECIAL OFFER", frameTextColor: "#fffbeb", canvasBg: "#fffbeb", pattern: "dots", patternColor: "#b45309", gradient: { enabled: false, type: "linear", from: "#000", to: "#000", rotation: 0 } } },
];
