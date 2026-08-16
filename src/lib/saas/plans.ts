// ─── Phase 9: plan registry + feature limits ─────────────────────────
// Pure logic (no Prisma) so it is unit-testable without a database.
import type { FeatureModule } from "@prisma/client";

export const FEATURE_MODULES: FeatureModule[] = [
  "LIBRARY",
  "TRANSPORT",
  "PAYROLL",
  "AI",
  "HOSTEL",
  "CLINIC",
  "INVENTORY",
  "CERTIFICATES",
  "MESSAGING",
  "REPORTS",
  "BILLING",
];

export interface PlanFeatures {
  maxStudents: number;
  maxTeachers: number;
  storageMb: number;
  aiTokensPerMonth: number;
  apiCallsPerMonth: number;
  modules: Record<FeatureModule, boolean>;
}

export function isPlanFeatures(v: unknown): v is PlanFeatures {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  return (
    typeof f.maxStudents === "number" &&
    typeof f.maxTeachers === "number" &&
    typeof f.storageMb === "number" &&
    typeof f.aiTokensPerMonth === "number" &&
    typeof f.apiCallsPerMonth === "number" &&
    typeof f.modules === "object" &&
    f.modules !== null
  );
}

export function defaultModules(): Record<FeatureModule, boolean> {
  return Object.fromEntries(FEATURE_MODULES.map((m) => [m, false])) as Record<
    FeatureModule,
    boolean
  >;
}

/** Parse the plan `features` Json. Fail-closed: zero limits, modules off. */
export function parsePlanFeatures(features: unknown): PlanFeatures {
  if (isPlanFeatures(features)) return features;
  return {
    maxStudents: 0,
    maxTeachers: 0,
    storageMb: 0,
    aiTokensPerMonth: 0,
    apiCallsPerMonth: 0,
    modules: defaultModules(),
  };
}

export function moduleEnabled(features: PlanFeatures, module: FeatureModule): boolean {
  return features.modules[module] === true;
}

/** Merge plan module defaults with per-school overrides. */
export function resolveModules(
  features: PlanFeatures,
  overrides: { module: FeatureModule; enabled: boolean }[]
): Record<FeatureModule, boolean> {
  const out = { ...features.modules };
  for (const o of overrides) out[o.module] = o.enabled;
  return out;
}
