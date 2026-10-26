const dev = process.env.NODE_ENV !== "production";
const https = (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://");

/**
 * The page Content-Security-Policy is set per request by src/middleware.ts with a
 * nonce (see src/lib/csp.ts). Responses the middleware doesn't touch (API JSON,
 * static assets) get this restrictive fallback; uploads and brand images get the
 * sandboxing policy below.
 */
const fallbackCsp = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS only when served over HTTPS (never on plain-HTTP local/test builds).
  ...(!dev && https ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig = {
  // Optional separate build folder (lets a dev server and a production test build coexist).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "nodemailer"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: fallbackCsp }] },
      // User uploads and brand images: a sandboxing CSP (later rules override the global one above),
      // so even an SVG/PDF opened directly can't run script or load anything.
      ...["/f/:path*", "/brand/:path*"].map((source) => ({
        source,
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" }],
      })),
      // Admin console pages are never cached or indexed.
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
