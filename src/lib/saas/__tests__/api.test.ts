import { describe, expect, it } from "vitest";
import { currentPeriod, minorToMajor, monthsAgoPeriod, parsePagination } from "../api";

describe("period helpers", () => {
  it("formats the current period as YYYY-MM", () => {
    expect(currentPeriod()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("monthsAgoPeriod steps backwards", () => {
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const label = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}`;
    expect(monthsAgoPeriod(3)).toBe(label);
  });
});

describe("minorToMajor", () => {
  it("converts minor units to major with 2 decimals", () => {
    expect(minorToMajor(2900)).toBe("29.00");
    expect(minorToMajor(0)).toBe("0.00");
    expect(minorToMajor(5)).toBe("0.05");
  });
});

describe("parsePagination", () => {
  it("applies defaults", () => {
    const p = parsePagination(new URLSearchParams(""));
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(50);
    expect(p.order).toBe("desc");
  });

  it("parses explicit values and clamps", () => {
    const p = parsePagination(new URLSearchParams("page=3&pageSize=9999&order=asc"));
    expect(p.page).toBe(3);
    expect(p.pageSize).toBe(200); // clamped to max
    expect(p.order).toBe("asc");
  });

  it("ignores garbage input", () => {
    const p = parsePagination(new URLSearchParams("page=abc&pageSize=-5"));
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(50);
  });
});
