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

/** Wraps a route handler with uniform error handling and logging. */
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message, details: e.details }, e.status);
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[api]", req.method, new URL(req.url).pathname, e);
      await logEvent("error", "api.unhandled", `${req.method} ${new URL(req.url).pathname}: ${msg}`.slice(0, 1000));
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

export async function readJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 1_000_000) throw new ApiError(413, "Request is too large.");
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

export function clientIp(req: Request) {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

export function baseUrl(req?: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}
