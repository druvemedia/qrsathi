import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, newNonce } from "@/lib/csp";

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
  // Pages: a per-request CSP nonce (Next.js reads it from the request's CSP header and
  // stamps its scripts; the root layout reads x-nonce), and the requested path so the
  // admin console's sign-in redirect can return to the same page.
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    const nonce = newNonce();
    const csp = buildCsp(nonce);
    const headers = new Headers(req.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    headers.set("x-admin-path", req.nextUrl.pathname + req.nextUrl.search);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
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

// Everything except build assets, uploads/brand files (sandboxed by next.config) and static files.
export const config = {
  matcher: ["/((?!_next/static|_next/image|f/|brand/|zxing/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wasm|txt|xml|webmanifest)$).*)"],
};
