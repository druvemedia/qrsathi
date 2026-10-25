import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { baseUrl } from "@/lib/api";
import { createSession, isAdminEmail } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { logEvent } from "@/lib/log";

export async function GET(req: Request) {
  const base = baseUrl(req);
  const fail = (code: string) => NextResponse.redirect(`${base}/login?error=${code}`);
  const url = new URL(req.url);
  const jar = await cookies();
  const state = jar.get("g_state")?.value;
  const next = jar.get("g_next")?.value || "/dashboard";
  jar.delete("g_state");
  jar.delete("g_next");

  if (!state || state !== url.searchParams.get("state")) return fail("google_state");
  const code = url.searchParams.get("code");
  if (!code) return fail("google_cancelled");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail("google_token");
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!infoRes.ok) return fail("google_profile");
    const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
    if (!info.email || !info.email_verified) return fail("google_unverified");
    const email = info.email.toLowerCase();

    let user = await db.user.findFirst({ where: { OR: [{ googleId: info.sub }, { email }] } });
    if (user) {
      if (user.status !== "active") return fail("suspended");
      user = await db.user.update({
        where: { id: user.id },
        data: { googleId: info.sub, lastLoginAt: new Date(), ...(isAdminEmail(email) ? { role: "admin" } : {}) },
      });
    } else {
      const settings = await getSettings();
      if (!settings.allowSignups && !isAdminEmail(email)) return fail("signups_closed");
      user = await db.user.create({
        data: { email, name: info.name || email.split("@")[0], googleId: info.sub, role: isAdminEmail(email) ? "admin" : "user", lastLoginAt: new Date() },
      });
      await logEvent("info", "auth.signup_google", email, user.id);
    }
    await createSession(user);
    return NextResponse.redirect(`${base}${next}`);
  } catch (e) {
    await logEvent("error", "auth.google_failed", e instanceof Error ? e.message : String(e));
    return fail("google_failed");
  }
}
