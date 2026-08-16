// ─── Phase 9: API key generation + verification ──────────────────────
// Keys look like `ef_<base64url>`. Only the SHA-256 hash is stored; the
// plaintext key is shown exactly once at creation time.
import { createHash, randomBytes } from "crypto";

export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const raw = randomBytes(24).toString("base64url");
  const key = `ef_${raw}`;
  return { key, prefix: key.slice(0, 11), keyHash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function isValidApiKeyFormat(key: string): boolean {
  return /^ef_[A-Za-z0-9_-]{20,}$/.test(key);
}
