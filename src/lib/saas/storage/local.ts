// ─── Phase 9: local storage adapter (dev default) ────────────────────
import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import type { StorageAdapter } from "./provider";

function safeName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return `${Date.now()}-${base}`;
}

export const localAdapter: StorageAdapter = {
  async upload({ buffer, fileName, mimeType, folder }) {
    void mimeType;
    const dir = join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });
    const name = safeName(fileName);
    await writeFile(join(dir, name), buffer);
    return { url: `/uploads/${folder}/${name}` };
  },

  async delete(url) {
    if (!url.startsWith("/uploads/")) return;
    try {
      await unlink(join(process.cwd(), "public", url));
    } catch {
      // Already gone — nothing to do.
    }
  },
};
