import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, isValidApiKeyFormat } from "../apikeys";

describe("api keys", () => {
  it("generates keys with the ef_ prefix and a stable hash", () => {
    const { key, prefix, keyHash } = generateApiKey();
    expect(key.startsWith("ef_")).toBe(true);
    expect(key.length).toBeGreaterThan(20);
    expect(prefix).toBe(key.slice(0, 11));
    expect(keyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hash is deterministic and not reversible", () => {
    const a = generateApiKey();
    expect(hashApiKey(a.key)).toBe(a.keyHash);
    expect(hashApiKey(a.key)).not.toContain(a.key);
  });

  it("validates key format", () => {
    expect(isValidApiKeyFormat("ef_" + "A".repeat(24))).toBe(true);
    expect(isValidApiKeyFormat("ef_short")).toBe(false);
    expect(isValidApiKeyFormat("stripe_sk_test_123")).toBe(false);
    expect(isValidApiKeyFormat("")).toBe(false);
  });
});
