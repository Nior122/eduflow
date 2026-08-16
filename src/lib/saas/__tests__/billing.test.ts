import { describe, expect, it } from "vitest";
import { applyCoupon, generateInvoiceNumber } from "../billing/service";

describe("applyCoupon", () => {
  it("no coupon → no discount", () => {
    expect(applyCoupon({ priceMinor: 7900, currency: "USD", coupon: null })).toEqual({
      totalMinor: 7900,
      discountMinor: 0,
    });
  });

  it("percent coupon", () => {
    const r = applyCoupon({
      priceMinor: 10000,
      currency: "USD",
      coupon: { discountType: "PERCENT", discountValue: 20 },
    });
    expect(r).toEqual({ totalMinor: 8000, discountMinor: 2000 });
  });

  it("percent clamps at 100", () => {
    const r = applyCoupon({
      priceMinor: 5000,
      currency: "USD",
      coupon: { discountType: "PERCENT", discountValue: 150 },
    });
    expect(r.totalMinor).toBe(0);
  });

  it("fixed coupon in minor units", () => {
    const r = applyCoupon({
      priceMinor: 2900,
      currency: "USD",
      coupon: { discountType: "FIXED", discountValue: 1000 },
    });
    expect(r).toEqual({ totalMinor: 1900, discountMinor: 1000 });
  });

  it("fixed discount never goes below zero", () => {
    const r = applyCoupon({
      priceMinor: 500,
      currency: "USD",
      coupon: { discountType: "FIXED", discountValue: 9999 },
    });
    expect(r.totalMinor).toBe(0);
    expect(r.discountMinor).toBe(500);
  });
});

describe("generateInvoiceNumber", () => {
  it("matches the EF-YYYY-XXXXXX format", () => {
    const n = generateInvoiceNumber();
    expect(n).toMatch(/^EF-\d{4}-[A-Z0-9]{6}$/);
  });

  it("is unique across calls", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateInvoiceNumber()));
    expect(seen.size).toBe(200);
  });
});
