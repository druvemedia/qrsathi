import { db } from "@/lib/db";
import { ApiError, baseUrl, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { getPlan } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { ALLOWED_UPLOADS, deleteStoredFile, sniffOk, storeFile } from "@/lib/storage";

export const GET = handle(async (req) => {
  const user = await requireUser();
  const items = await db.upload.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
  const base = baseUrl(req);
  return json({ items: items.map((u) => ({ ...u, url: `${base}/f/${u.storedName}` })) });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  rateLimit(`upload:${user.id}`, 30, 60 * 60 * 1000);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "No file received.");
  const limitMb = getPlan(user.plan).uploadMb;
  if (file.size > limitMb * 1024 * 1024) throw new ApiError(413, `File is larger than your plan's ${limitMb} MB limit.`);
  if (file.size === 0) throw new ApiError(400, "File is empty.");
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_UPLOADS[ext]) throw new ApiError(415, "Unsupported file type. Allowed: PDF, images, Office documents, TXT.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffOk(ext, buf)) throw new ApiError(415, "The file content doesn't match its extension.");
  const storedName = await storeFile(ext, buf);
  const upload = await db.upload.create({
    data: { userId: user.id, filename: file.name.slice(0, 200), storedName, mime: ALLOWED_UPLOADS[ext].mime, size: file.size },
  });
  return json({ item: { ...upload, url: `${baseUrl(req)}/f/${storedName}` } }, 201);
});

export const DELETE = handle(async (req) => {
  const user = await requireUser();
  const id = new URL(req.url).searchParams.get("id");
  const up = id ? await db.upload.findUnique({ where: { id } }) : null;
  if (!up || up.userId !== user.id) throw new ApiError(404, "File not found.");
  await deleteStoredFile(up.storedName);
  await db.upload.delete({ where: { id: up.id } });
  return json({ ok: true });
});
