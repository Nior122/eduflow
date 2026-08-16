import { describe, expect, it } from "vitest";
import {
  FEATURE_MODULES,
  defaultModules,
  moduleEnabled,
  parsePlanFeatures,
  resolveModules,
  type PlanFeatures,
} from "../plans";

const full: PlanFeatures = {
  maxStudents: 100,
  maxTeachers: 10,
  storageMb: 1024,
  aiTokensPerMonth: 100000,
  apiCallsPerMonth: 10000,
  modules: { ...defaultModules(), AI: true, BILLING: true },
};

describe("parsePlanFeatures", () => {
  it("parses a valid features object", () => {
    const f = parsePlanFeatures(full);
    expect(f.maxStudents).toBe(100);
    expect(f.modules.AI).toBe(true);
  });

  it("fails closed on garbage (zero limits, modules off)", () => {
    const f = parsePlanFeatures(null);
    expect(f.maxStudents).toBe(0);
    expect(f.maxTeachers).toBe(0);
    expect(f.modules.AI).toBe(false);
  });

  it("fails closed on partial objects", () => {
    const f = parsePlanFeatures({ maxStudents: 5 });
    expect(f.maxStudents).toBe(0);
    expect(f.modules.LIBRARY).toBe(false);
  });
});

describe("moduleEnabled / resolveModules", () => {
  it("reads module flags", () => {
    expect(moduleEnabled(full, "AI")).toBe(true);
    expect(moduleEnabled(full, "LIBRARY")).toBe(false);
  });

  it("merges overrides on top of plan defaults", () => {
    const merged = resolveModules(full, [
      { module: "LIBRARY", enabled: true },
      { module: "AI", enabled: false },
    ]);
    expect(merged.LIBRARY).toBe(true);
    expect(merged.AI).toBe(false);
    expect(merged.BILLING).toBe(true); // untouched default stays
  });

  it("covers every registered module", () => {
    const merged = resolveModules(full, []);
    for (const m of FEATURE_MODULES) {
      expect(Object.prototype.hasOwnProperty.call(merged, m)).toBe(true);
    }
  });
});
