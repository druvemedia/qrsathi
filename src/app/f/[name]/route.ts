import { db } from "@/lib/db";
import { ALLOWED_UPLOADS, readStoredFile } from "@/lib/storage";

type Ctx = { params: Promise<{ name: string }> };

/** Serves uploaded files with locked-down headers (no script execution, no sniffing). */
export async function GET(_req: Request, { params }: Ctx) {
  const { name } = await params;
  const upload = await db.upload.findUnique({ where: { storedName: name }, include: { user: { select: { status: true } } } });
  if (!upload || upload.user.status !== "active") return new Response("File not found", { status: 404 });
  const data = await readStoredFile(name);
  if (!data) return new Response("File not found", { status: 404 });
  const ext = name.split(".").pop()!;
  const meta = ALLOWED_UPLOADS[ext];
  const safeName = upload.filename.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": meta?.mime || "application/octet-stream",
      "Content-Disposition": `${meta?.inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
