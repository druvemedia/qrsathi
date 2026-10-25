import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { ASSET_KINDS, BRAND_DEFAULTS, brandingSchema, sameValue, type Branding } from "@/lib/branding";
import { BRANDING_DRAFT, BRANDING_PUBLISHED, brandingState, writeSetting } from "@/lib/settings";
import { ASSET_RULES } from "@/lib/image-check";

/** Draft/published branding plus recent uploads. Branding is public data: no secrets live here. */
export const GET = handle(async () => {
  await requireAdmin();
  const { published, draft, defaults } = await brandingState();
  const assets = await db.brandAsset.findMany({ orderBy: { createdAt: "desc" }, take: 40, select: { kind: true, storedName: true, width: true, height: true, size: true, mime: true, createdAt: true } });
  return json({ published, draft, defaults, assets, rules: ASSET_RULES });
});

/** Saves the draft (never affects the live site until published). */
export const PUT = handle(async (req) => {
  const admin = await requireAdmin();
  await rateLimit(`admin-branding:${admin.id}`, 120, 15 * 60 * 1000);
  const body = await readJson(req, brandingSchema, 20_000);
  await assertAssetsExist(body);
  await writeSetting(BRANDING_DRAFT, JSON.stringify(body));
  return json({ ok: true });
});

async function assertAssetsExist(b: Branding) {
  for (const k of ASSET_KINDS) {
    const name = b[k];
    if (!name) continue;
    const a = await db.brandAsset.findUnique({ where: { storedName: name } });
    if (!a || a.kind !== k) throw new ApiError(400, `The ${k} image isn't a known upload of that kind.`);
  }
}

const actionSchema = z.object({ action: z.enum(["publish", "discard", "reset"]) });

export const POST = handle(async (req) => {
  const admin = await requireAdmin();
  await rateLimit(`admin-branding:${admin.id}`, 120, 15 * 60 * 1000);
  const { action } = await readJson(req, actionSchema, 1_000);
  const { published, draft } = await brandingState();
  if (action === "discard") {
    await writeSetting(BRANDING_DRAFT, null);
    await audit("admin.branding.draft_discarded", { actor: admin, targetType: "branding", ip: clientIp(req) });
    return json({ ok: true });
  }
  if (action === "reset") {
    // Reset puts the defaults into the draft; the live site changes only after publishing.
    await writeSetting(BRANDING_DRAFT, JSON.stringify(BRAND_DEFAULTS));
    await audit("admin.branding.reset_to_defaults", { actor: admin, targetType: "branding", ip: clientIp(req) });
    return json({ ok: true });
  }
  if (!draft) throw new ApiError(400, "There are no unpublished changes.");
  await assertAssetsExist(draft);
  await writeSetting(BRANDING_PUBLISHED, JSON.stringify(draft));
  await writeSetting(BRANDING_DRAFT, null);
  const changed = (Object.keys(draft) as (keyof Branding)[]).filter((k) => !sameValue(draft[k], published[k]));
  await audit("admin.branding.published", { actor: admin, targetType: "branding", ip: clientIp(req), details: { changed } });
  for (const k of ASSET_KINDS) if (changed.includes(k)) await audit(`admin.branding.${k}_replaced`, { actor: admin, targetType: "brand_asset", targetId: draft[k] ?? "removed", ip: clientIp(req) });
  await cleanupAssets(draft, published);
  return json({ ok: true, changed });
});

/** Keeps the 5 newest uploads per kind plus anything referenced by the live site; deletes older unused files. */
async function cleanupAssets(...keep: Branding[]) {
  const referenced = new Set(keep.flatMap((b) => ASSET_KINDS.map((k) => b[k]).filter(Boolean) as string[]));
  const { deleteStoredFile } = await import("@/lib/storage");
  for (const kind of ASSET_KINDS) {
    const old = await db.brandAsset.findMany({ where: { kind }, orderBy: { createdAt: "desc" }, skip: 5 });
    for (const a of old) {
      if (referenced.has(a.storedName)) continue;
      await db.brandAsset.delete({ where: { id: a.id } });
      await deleteStoredFile(a.storedName);
    }
  }
}
