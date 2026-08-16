// ─── Phase 9: feature flags — plan defaults + per-school overrides ───
import { prisma } from "@/lib/db";
import type { FeatureModule } from "@prisma/client";
import { parsePlanFeatures } from "./plans";

export async function getEffectiveModules(
  schoolId: string
): Promise<Record<FeatureModule, boolean>> {
  const [school, flags] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        subscription: { select: { plan: { select: { features: true } } } },
      },
    }),
    prisma.featureFlag.findMany({ where: { schoolId } }),
  ]);
  const features = parsePlanFeatures(school?.subscription?.plan?.features);
  const overrides = flags.map((f) => ({ module: f.module as FeatureModule, enabled: f.enabled }));
  const out = { ...features.modules };
  for (const o of overrides) out[o.module] = o.enabled;
  return out;
}

export async function canUseModule(schoolId: string, module: FeatureModule): Promise<boolean> {
  const modules = await getEffectiveModules(schoolId);
  return modules[module] === true;
}

/** Toggle a school's override (upsert). */
export async function setFeatureOverride(
  schoolId: string,
  module: FeatureModule,
  enabled: boolean
) {
  return prisma.featureFlag.upsert({
    where: { schoolId_module: { schoolId, module } },
    update: { enabled },
    create: { schoolId, module, enabled },
  });
}
