// ─── Phase 9: Cloudinary storage adapter (signed REST, no SDK) ───────
import { createHash } from "crypto";
import type { StorageAdapter } from "./provider";

function keys(): { cloud: string; apiKey: string; apiSecret: string } {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET not configured");
  }
  return { cloud, apiKey, apiSecret };
}

export const cloudinaryAdapter: StorageAdapter = {
  async upload({ buffer, fileName, mimeType, folder }) {
    const { cloud, apiKey, apiSecret } = keys();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicFolder = `eduflow/${folder}`;
    const signature = createHash("sha1")
      .update(`folder=${publicFolder}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const form = new FormData();
    form.append("file", new Blob([Uint8Array.from(buffer)], { type: mimeType }), fileName);
    form.append("folder", publicFolder);
    form.append("timestamp", timestamp);
    form.append("api_key", apiKey);
    form.append("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) {
      throw new Error("Cloudinary upload failed: " + (data.error?.message ?? res.statusText));
    }
    return { url: data.secure_url };
  },

  async delete(url) {
    const { cloud, apiKey, apiSecret } = keys();
    const m = url.match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!m) return;
    const publicId = m[1].replace(/\.[a-z0-9]+$/i, "");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");
    try {
      await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ public_id: publicId, timestamp, api_key: apiKey, signature }).toString(),
      });
    } catch {
      // Best-effort delete.
    }
  },
};
