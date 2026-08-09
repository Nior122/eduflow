import { mkdir, writeFile, unlink, stat } from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * PHASE 6 — Local file upload helper.
 * Files are stored under public/uploads/<folder> so they are served
 * statically by Next.js. For serverless/cloud deploys swap this module
 * for S3/R2 (same return shape), see README "Storage".
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "zip",
  "jpg", "jpeg", "png", "gif", "webp",
  "mp3", "mp4",
]);

export type SavedUpload = {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
};

export async function saveUpload(file: File, opts: { folder: string }): Promise<SavedUpload> {
  const originalName = file.name || "file";
  const ext = originalName.includes(".")
    ? originalName.split(".").pop()!.toLowerCase()
    : "";

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type ".${ext || "unknown"}" is not allowed`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds the 10 MB limit");
  }

  const safeBase = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const safeName = `${crypto.randomUUID()}-${safeBase}`;
  const dir = path.join(process.cwd(), "public", "uploads", opts.folder);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, safeName), buffer);

  return {
    url: `/uploads/${opts.folder}/${safeName}`,
    fileName: originalName,
    fileSize: file.size,
    mimeType: file.type || null,
  };
}

export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return;
  try {
    const target = path.join(process.cwd(), "public", url);
    await stat(target);
    await unlink(target);
  } catch {
    // Already gone or outside uploads — ignore.
  }
}
