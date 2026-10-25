import { z } from "zod";
import type { QrCode, User } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";
import { getPlan } from "./plans";
import { TYPE_MAP, buildPayload, isHostedType, validateContent } from "./qr-types";
import { isHttpUrl, randomCode } from "./utils";

export const RESERVED_CODES = new Set(["admin", "api", "app", "login", "signup", "dashboard", "preview", "static", "assets", "r", "p", "f"]);

export const utmSchema = z
  .object({
    source: z.string().trim().max(100).default(""),
    medium: z.string().trim().max(100).default(""),
    campaign: z.string().trim().max(100).default(""),
    term: z.string().trim().max(100).default(""),
    content: z.string().trim().max(100).default(""),
  })
  .partial();

const designSchema = z.record(z.string(), z.unknown()).refine((d) => JSON.stringify(d).length < 400_000, "Design is too large (logo image too big?)");

export const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  type: z.string(),
  content: z.record(z.string(), z.unknown()),
  design: designSchema,
  dynamic: z.boolean().default(false),
  alias: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{3,40}$/, "Alias: 3–40 letters, numbers, - or _")
    .optional()
    .or(z.literal("")),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional().or(z.literal("")),
  utm: utmSchema.optional(),
  campaign: z.string().trim().max(80).optional(),
  trackScans: z.boolean().optional(),
});

export const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  design: designSchema.optional(),
  status: z.enum(["active", "paused"]).optional(),
  favorite: z.boolean().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional().or(z.literal("")),
  utm: utmSchema.optional(),
  campaign: z.string().trim().max(80).optional(),
  trackScans: z.boolean().optional(),
});

function contentOrThrow(type: string, content: unknown) {
  const t = TYPE_MAP[type];
  if (!t) throw new ApiError(400, "Unknown QR type.");
  const v = validateContent(t, content);
  if (!v.ok) throw new ApiError(400, Object.values(v.errors)[0] || "Invalid content.", v.errors);
  return { t, data: v.data! };
}

async function uniqueCode(alias?: string) {
  if (alias) {
    if (RESERVED_CODES.has(alias.toLowerCase())) throw new ApiError(400, "That alias is reserved. Try another.");
    const exists = await db.qrCode.findUnique({ where: { shortCode: alias } });
    if (exists) throw new ApiError(409, "That alias is already taken.");
    return alias;
  }
  for (let i = 0; i < 6; i++) {
    const code = randomCode(7);
    if (!(await db.qrCode.findUnique({ where: { shortCode: code } }))) return code;
  }
  throw new ApiError(500, "Could not allocate a short code. Please retry.");
}

async function checkLimits(user: User, kind: { dynamic: boolean; hosted: boolean }) {
  const plan = getPlan(user.plan);
  const total = await db.qrCode.count({ where: { userId: user.id } });
  if (total >= plan.savedLimit) throw new ApiError(403, `Your ${plan.name} plan allows ${plan.savedLimit} saved QR codes. Delete some or upgrade.`);
  if (kind.hosted) {
    const n = await db.qrCode.count({ where: { userId: user.id, isHosted: true } });
    if (n >= plan.hostedLimit) throw new ApiError(403, `Your ${plan.name} plan allows ${plan.hostedLimit} hosted pages. Upgrade for more.`);
  } else if (kind.dynamic) {
    const n = await db.qrCode.count({ where: { userId: user.id, isDynamic: true, isHosted: false } });
    if (n >= plan.dynamicLimit) throw new ApiError(403, `Your ${plan.name} plan allows ${plan.dynamicLimit} dynamic QR codes. Upgrade for more.`);
  }
}

function parseExpiry(user: User, v: string | null | undefined) {
  if (v === undefined) return undefined;
  if (!v) return null;
  if (!getPlan(user.plan).expiry) throw new ApiError(403, "Expiry dates are available on Pro and Business plans.");
  const d = new Date(v);
  if (d.getTime() < Date.now()) throw new ApiError(400, "Expiry must be in the future.");
  return d;
}

export async function createQr(user: User, input: z.infer<typeof createSchema>, base: string) {
  const { t, data } = contentOrThrow(input.type, input.content);
  const hosted = isHostedType(t, data);
  const dynamic = hosted || !!t.forceDynamic || (input.dynamic && !!t.dynamicCapable);
  if (input.dynamic && !t.dynamicCapable && !hosted) throw new ApiError(400, `${t.label} QR codes can't be dynamic — they don't open a web link.`);
  await checkLimits(user, { dynamic, hosted });

  const plan = getPlan(user.plan);
  if (input.alias && !plan.customAlias) throw new ApiError(403, "Custom aliases are available on Pro and Business plans.");
  const expiresAt = dynamic ? parseExpiry(user, input.expiresAt) : null;

  let shortCode: string | null = null;
  let destination: string | null = null;
  let payload: string;
  if (dynamic) {
    shortCode = await uniqueCode(input.alias || undefined);
    if (hosted) payload = `${base}/p/${shortCode}`;
    else {
      destination = buildPayload(t, data, { hostedUrl: "" });
      if (!isHttpUrl(destination)) throw new ApiError(400, "Dynamic QR codes need a web (http/https) destination.");
      payload = `${base}/r/${shortCode}`;
    }
  } else {
    payload = buildPayload(t, data, { hostedUrl: "" });
  }

  return db.qrCode.create({
    data: {
      userId: user.id,
      name: input.name,
      type: t.id,
      content: JSON.stringify(data),
      design: JSON.stringify(input.design),
      payload,
      isDynamic: dynamic,
      isHosted: hosted,
      shortCode,
      destination,
      expiresAt: expiresAt ?? null,
      utm: input.utm ? JSON.stringify(input.utm) : null,
      campaign: input.campaign || "",
      trackScans: input.trackScans ?? true,
    },
  });
}

export async function getOwnedQr(user: User, id: string) {
  const qr = await db.qrCode.findUnique({ where: { id } });
  if (!qr || qr.userId !== user.id) throw new ApiError(404, "QR code not found.");
  return qr;
}

export async function updateQr(user: User, qr: QrCode, input: z.infer<typeof updateSchema>, base: string) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.design !== undefined) data.design = JSON.stringify(input.design);
  if (input.favorite !== undefined) data.favorite = input.favorite;
  if (input.campaign !== undefined) data.campaign = input.campaign;
  if (input.trackScans !== undefined) data.trackScans = input.trackScans;
  if (input.utm !== undefined) data.utm = JSON.stringify(input.utm);
  if (input.status !== undefined) {
    if (qr.status === "disabled") throw new ApiError(403, "This QR code was disabled by an administrator.");
    data.status = input.status;
  }
  if (input.expiresAt !== undefined && qr.isDynamic) data.expiresAt = parseExpiry(user, input.expiresAt);

  if (input.content !== undefined) {
    const { t, data: content } = contentOrThrow(qr.type, input.content);
    const hosted = isHostedType(t, content);
    if (qr.isDynamic && hosted !== qr.isHosted)
      throw new ApiError(400, "Can't switch between a hosted page and a link on an existing dynamic QR. Duplicate it instead.");
    data.content = JSON.stringify(content);
    if (qr.isDynamic && !qr.isHosted) {
      const dest = buildPayload(t, content, { hostedUrl: "" });
      if (!isHttpUrl(dest)) throw new ApiError(400, "Dynamic QR codes need a web (http/https) destination.");
      data.destination = dest;
    } else if (!qr.isDynamic) {
      // Static QR: the image itself changes — previously printed copies keep the old content.
      data.payload = buildPayload(t, content, { hostedUrl: `${base}/p/${qr.shortCode}` });
    }
  }
  return db.qrCode.update({ where: { id: qr.id }, data });
}

export async function duplicateQr(user: User, qr: QrCode, base: string) {
  await checkLimits(user, { dynamic: qr.isDynamic, hosted: qr.isHosted });
  let shortCode: string | null = null;
  let payload = qr.payload;
  if (qr.isDynamic) {
    shortCode = await uniqueCode();
    payload = `${base}/${qr.isHosted ? "p" : "r"}/${shortCode}`;
  }
  return db.qrCode.create({
    data: {
      userId: user.id,
      name: `${qr.name} (copy)`.slice(0, 100),
      type: qr.type,
      content: qr.content,
      design: qr.design,
      payload,
      isDynamic: qr.isDynamic,
      isHosted: qr.isHosted,
      shortCode,
      destination: qr.destination,
      utm: qr.utm,
      campaign: qr.campaign,
      trackScans: qr.trackScans,
    },
  });
}

export function serializeQr(qr: QrCode & { _count?: { scans: number } }) {
  return {
    id: qr.id,
    name: qr.name,
    type: qr.type,
    content: JSON.parse(qr.content),
    design: JSON.parse(qr.design),
    payload: qr.payload,
    isDynamic: qr.isDynamic,
    isHosted: qr.isHosted,
    shortCode: qr.shortCode,
    destination: qr.destination,
    status: qr.status,
    expiresAt: qr.expiresAt,
    utm: qr.utm ? JSON.parse(qr.utm) : null,
    campaign: qr.campaign,
    trackScans: qr.trackScans,
    favorite: qr.favorite,
    isDemo: qr.isDemo,
    createdAt: qr.createdAt,
    updatedAt: qr.updatedAt,
    scans: qr._count?.scans,
  };
}
export type QrDto = ReturnType<typeof serializeQr>;

/** Appends UTM parameters that the destination does not already define. */
export function withUtm(destination: string, utmJson: string | null) {
  if (!utmJson) return destination;
  try {
    const utm = JSON.parse(utmJson) as Record<string, string>;
    const u = new URL(destination);
    for (const [k, v] of Object.entries(utm)) {
      if (v && !u.searchParams.has(`utm_${k}`)) u.searchParams.set(`utm_${k}`, v);
    }
    return u.toString();
  } catch {
    return destination;
  }
}
