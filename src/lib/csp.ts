/**
 * Content-Security-Policy for HTML responses. Edge-safe (used by middleware).
 *
 * Scripts: a per-request nonce plus 'strict-dynamic' — Next.js stamps the nonce
 * on its own scripts, the root layout stamps it on the theme script, and
 * scripts those load (route chunks, Razorpay Checkout) inherit trust. No
 * 'unsafe-inline' for scripts. 'self' and the Razorpay host remain only as a
 * fallback for old browsers that ignore 'strict-dynamic'.
 * 'wasm-unsafe-eval' is needed by the zxing barcode scanner.
 * Styles keep 'unsafe-inline' (React style attributes and next/font).
 */
export function buildCsp(nonce: string, dev = process.env.NODE_ENV !== "production") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' https://checkout.razorpay.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com${dev ? " ws: wss:" : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** 128-bit random nonce, base64. */
export function newNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
