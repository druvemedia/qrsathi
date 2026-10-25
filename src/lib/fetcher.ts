"use client";

export class FetchError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** JSON fetch wrapper that throws FetchError with the API's error message. */
export async function api<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new FetchError(res.status, data.error || `Request failed (${res.status})`, data.details);
  return data as T;
}
