import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { baseUrl } from "@/lib/api";
import { googleConfigured } from "@/lib/config";

/** Starts the Google OAuth (OpenID Connect) authorization-code flow. */
export async function GET(req: Request) {
  const base = baseUrl(req);
  if (!googleConfigured()) return NextResponse.redirect(`${base}/login?error=google_not_configured`);
  const state = randomBytes(24).toString("base64url");
  const next = new URL(req.url).searchParams.get("next") || "/dashboard";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${base}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  res.cookies.set("g_state", state, cookieOpts);
  res.cookies.set("g_next", next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard", cookieOpts);
  return res;
}
