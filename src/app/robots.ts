import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/dashboard", "/analytics", "/dynamic", "/products", "/inventory", "/scan-history", "/r/", "/p/", "/f/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
