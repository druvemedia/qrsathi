import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF defence for cookie-authenticated API calls: state-changing requests
 * must come from this site's own origin. Webhooks are exempt (they verify
 * signatures instead).
 */
export function middleware(req: NextRequest) {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/billing/webhook")) return NextResponse.next();

  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host) {
    return NextResponse.json({ error: "Missing origin." }, { status: 403 });
  }
  try {
    if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
