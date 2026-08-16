// ─── Phase 9: storage provider abstraction ───────────────────────────
// `local` (default, dev) writes into public/uploads; `cloudinary` uploads
// to Cloudinary via signed REST calls. Set STORAGE_PROVIDER=cloudinary
// plus CLOUDINARY_* keys for production object storage.
export interface StorageAdapter {
  upload(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    folder: string;
  }): Promise<{ url: string }>;
  delete(url: string): Promise<void>;
}

export async function getStorageAdapter(): Promise<StorageAdapter> {
  const p = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  if (p === "cloudinary") return (await import("./cloudinary")).cloudinaryAdapter;
  return (await import("./local")).localAdapter;
}
