import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const pages = ["", "/features", "/tools", "/generator", "/barcodes", "/upi", "/studio", "/bulk", "/scanner", "/pricing", "/help", "/about", "/contact", "/privacy", "/terms"];
  return pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : p === "/upi" || p === "/generator" ? 0.9 : 0.6 }));
}
