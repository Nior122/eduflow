// Simple in-memory sliding-window rate limiter.
// NOTE: per-instance only — replace with a shared store (e.g. Upstash
// Redis) before scaling horizontally. Used for public endpoints
// (register) and paid AI endpoints.
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < opts.windowMs);
  if (hits.length >= opts.limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

// Convenience: key by IP (or caller id) + action.
export function ipKey(ip: string, action: string): string {
  return `${action}:${ip}`;
}
