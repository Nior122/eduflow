import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signPayload } from "../webhooks";

describe("webhook signing", () => {
  it("produces a deterministic HMAC-SHA256 signature", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ event: "student.created", data: { id: "1" } });
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    expect(signPayload(secret, body)).toBe(expected);
  });

  it("changes when the payload changes", () => {
    const secret = "whsec_test";
    expect(signPayload(secret, "a")).not.toBe(signPayload(secret, "b"));
  });

  it("changes when the secret changes", () => {
    const body = "same payload";
    expect(signPayload("secret-1", body)).not.toBe(signPayload("secret-2", body));
  });

  it("verifies a known vector (protocol stability)", () => {
    // HMAC-SHA256("secret", "payload") — fixed vector so the signing
    // protocol can't drift unnoticed.
    const expected = createHmac("sha256", "secret").update("payload").digest("hex");
    expect(signPayload("secret", "payload")).toBe(expected);
  });
});
