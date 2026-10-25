import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

type Ctx = { params: Promise<{ name: string }> };

/**
 * Public branding images (logo, favicon, social image). Names are random and
 * never reused, so responses are cached as immutable. SVGs are sandboxed: even
 * when opened directly they can't run script or load anything.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { name } = await params;
  if (!/^[a-f0-9]{32}\.(png|jpg|webp|svg)$/.test(name)) return new Response("Not found", { status: 404 });
  const asset = await db.brandAsset.findUnique({ where: { storedName: name } });
  if (!asset) return new Response("Not found", { status: 404 });
  const data = await readStoredFile(name);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
