import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF defence for cookie-authenticated API calls: state-changing requests
 * must come from this site's own origin. Webhooks are exempt (they verify
 * signatures instead).
 *
 * In production the only accepted origin is NEXT_PUBLIC_APP_URL. Forwarded
 * host headers are client-controllable unless a trusted proxy sets them, so
 * they are honoured only when TRUST_PROXY is configured.
 */
export function allowedOrigins(req: Pick<NextRequest, "headers">, env: Record<string, string | undefined> = process.env) {
  const out = new Set<string>();
  const app = env.NEXT_PUBLIC_APP_URL;
  if (app) {
    try { out.add(new URL(app).origin); } catch {}
  }
  if (env.NODE_ENV !== "production" || !app) {
    const fwd = env.TRUST_PROXY ? req.headers.get("x-forwarded-host") : null;
    const host = fwd || req.headers.get("host");
    if (host) {
      const proto = (env.TRUST_PROXY && req.headers.get("x-forwarded-proto")) || (env.NODE_ENV === "production" ? "https" : "http");
      out.add(`${proto}://${host}`);
      if (env.NODE_ENV !== "production") out.add(`http://${host}`).add(`https://${host}`);
    }
  }
  return out;
}

export function middleware(req: NextRequest) {
  const method = req.method.toUpperCase();
  // Admin console pages: pass the requested path to the console layout so its
  // sign-in redirect can return the administrator to the same page.
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    const headers = new Headers(req.headers);
    headers.set("x-admin-path", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  }
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/billing/webhook")) return NextResponse.next();

  const origin = req.headers.get("origin");
  if (!origin) return NextResponse.json({ error: "Missing origin." }, { status: 403 });
  let o: string;
  try {
    o = new URL(origin).origin;
  } catch {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  if (!allowedOrigins(req).has(o)) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/admin", "/admin/:path*"] };
