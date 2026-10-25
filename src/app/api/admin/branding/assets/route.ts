import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, assertBodySize, clientIp, handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { ASSET_KINDS } from "@/lib/branding";
import { ASSET_RULES, checkAssetRules, inspectImage } from "@/lib/image-check";
import { storeFile } from "@/lib/storage";

/**
 * Uploads a branding image. It is stored under a new random name, so pages that
 * still reference the previous asset keep working; it goes live only when the
 * branding draft that uses it is published.
 */
export const POST = handle(async (req) => {
  const admin = await requireAdmin();
  await rateLimit(`admin-brand-upload:${admin.id}`, 30, 15 * 60 * 1000);
  assertBodySize(req, 2 * 1024 * 1024 + 64 * 1024);
  const form = await req.formData().catch(() => null);
  const kind = z.enum(ASSET_KINDS).safeParse(form?.get("kind"));
  if (!kind.success) throw new ApiError(400, "Unknown image kind.");
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Choose an image file.");
  if (file.size > ASSET_RULES[kind.data].maxBytes) throw new ApiError(413, `The file is larger than ${Math.round(ASSET_RULES[kind.data].maxBytes / 1024)} KB.`);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  const info = inspectImage(buf, ext);
  if ("error" in info) throw new ApiError(415, info.error);
  const rule = checkAssetRules(kind.data, buf.length, info);
  if (rule) throw new ApiError(400, rule);
  const storedName = await storeFile(info.type, buf);
  const asset = await db.brandAsset.create({ data: { kind: kind.data, storedName, mime: info.mime, width: info.width, height: info.height, size: buf.length, createdBy: admin.id } });
  await audit("admin.branding.asset_uploaded", { actor: admin, targetType: "brand_asset", targetId: storedName, ip: clientIp(req), details: { kind: kind.data, type: info.type, width: info.width, height: info.height, size: buf.length } });
  return json({ asset: { kind: asset.kind, storedName, width: info.width, height: info.height, size: buf.length, mime: info.mime, url: `/brand/${storedName}` } }, 201);
});
