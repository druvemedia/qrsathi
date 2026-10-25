import { NextResponse } from "next/server";
import type { z } from "zod";
import { logEvent } from "./log";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler with uniform error handling and logging (no internals leak to clients). */
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message, details: e.details }, e.status);
      const msg = e instanceof Error ? e.message : String(e);
      await logEvent("error", "api.unhandled", `${req.method} ${new URL(req.url).pathname}: ${msg}`.slice(0, 1000));
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

/** Rejects bodies larger than `max` bytes before reading them (Content-Length check). */
export function assertBodySize(req: Request, max: number) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > max) throw new ApiError(413, "Request is too large.");
}

export async function readJson<T extends z.ZodTypeAny>(req: Request, schema: T, maxBytes = 1_000_000): Promise<z.infer<T>> {
  assertBodySize(req, maxBytes);
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) throw new ApiError(413, "Request is too large.");
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "Invalid JSON body.");
  }
  const r = schema.safeParse(body);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new ApiError(400, first ? `${first.path.join(".") ? first.path.join(".") + ": " : ""}${first.message}` : "Invalid input.");
  }
  return r.data;
}

/**
 * Client IP for rate limiting and audit.
 *
 * Next.js only fills X-Forwarded-For when the client didn't send one, so the
 * header is attacker-controlled unless a reverse proxy overwrites it.
 *  TRUST_PROXY=true        behind nginx/Caddy/etc.: use X-Real-IP, else the
 *                          right-most X-Forwarded-For entry (added by the proxy)
 *  TRUST_PROXY=cloudflare  use CF-Connecting-IP
 *  unset                   use the right-most X-Forwarded-For entry (Next's own
 *                          value when no proxy) — spoofable; per-account and
 *                          global limits still apply.
 */
export function clientIp(req: Request) {
  return ipFromHeaders(req.headers);
}

/** Client IP from request headers (also used by server components). */
export function ipFromHeaders(h: Headers) {
  const trust = process.env.TRUST_PROXY;
  if (trust === "cloudflare" && h.get("cf-connecting-ip")) return h.get("cf-connecting-ip")!;
  if (trust === "true" && h.get("x-real-ip")) return h.get("x-real-ip")!;
  const xff = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return xff?.length ? xff[xff.length - 1] : "unknown";
}

/**
 * Public base URL used for links in e-mails, short links and OAuth callbacks.
 * In production NEXT_PUBLIC_APP_URL is required (validated at startup) so the
 * Host header can never poison password-reset links.
 */
export function baseUrl(req?: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new ApiError(500, "Server misconfigured: NEXT_PUBLIC_APP_URL is not set.");
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}
