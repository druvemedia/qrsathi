import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

/**
 * Local-disk object storage for uploaded files. Files live outside /public and
 * are only served through /f/[name] with safe headers. To use S3/R2/Supabase
 * Storage, replace these three functions.
 */
const dir = () => path.resolve(process.env.UPLOAD_DIR || "./uploads");

export const ALLOWED_UPLOADS: Record<string, { mime: string; inline: boolean }> = {
  pdf: { mime: "application/pdf", inline: true },
  png: { mime: "image/png", inline: true },
  jpg: { mime: "image/jpeg", inline: true },
  jpeg: { mime: "image/jpeg", inline: true },
  webp: { mime: "image/webp", inline: true },
  gif: { mime: "image/gif", inline: true },
  txt: { mime: "text/plain; charset=utf-8", inline: true },
  doc: { mime: "application/msword", inline: false },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false },
  xls: { mime: "application/vnd.ms-excel", inline: false },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false },
  ppt: { mime: "application/vnd.ms-powerpoint", inline: false },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", inline: false },
};

/** Light magic-byte check so a renamed executable/HTML file is rejected. */
export function sniffOk(ext: string, buf: Buffer) {
  const hex = buf.subarray(0, 8).toString("hex");
  switch (ext) {
    case "pdf": return buf.subarray(0, 5).toString() === "%PDF-";
    case "png": return hex.startsWith("89504e47");
    case "jpg": case "jpeg": return hex.startsWith("ffd8ff");
    case "gif": return buf.subarray(0, 4).toString() === "GIF8";
    case "webp": return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
    case "docx": case "xlsx": case "pptx": return hex.startsWith("504b0304");
    case "doc": case "xls": case "ppt": return hex.startsWith("d0cf11e0");
    case "txt": return !buf.subarray(0, 512).includes(0);
    default: return false;
  }
}

export async function storeFile(ext: string, data: Buffer) {
  await fs.mkdir(dir(), { recursive: true });
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir(), name), data);
  return name;
}

export async function readStoredFile(name: string) {
  if (!/^[a-f0-9]{32}\.[a-z]{2,5}$/.test(name)) return null;
  try {
    return await fs.readFile(path.join(dir(), name));
  } catch {
    return null;
  }
}

export async function deleteStoredFile(name: string) {
  if (!/^[a-f0-9]{32}\.[a-z]{2,5}$/.test(name)) return;
  await fs.unlink(path.join(dir(), name)).catch(() => {});
}
