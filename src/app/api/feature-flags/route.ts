import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { getEffectiveModules, setFeatureOverride } from "@/lib/saas/features";
import { parsePlanFeatures } from "@/lib/saas/plans";
import { audit } from "@/lib/saas/audit";
import type { FeatureModule } from "@prisma/client";

/**
 * GET /api/feature-flags — effective modules (plan defaults + overrides).
 * PUT /api/feature-flags — toggle a school override: { module, enabled }
 */
export async function GET() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const [school, overrides] = await Promise.all([
    prisma.school.findUnique({
      where: { id: guard.schoolId },
      select: { subscription: { select: { plan: { select: { features: true, code: true } } } } },
    }),
    prisma.featureFlag.findMany({ where: { schoolId: guard.schoolId } }),
  ]);
  const planFeatures = parsePlanFeatures(school?.subscription?.plan?.features);
  const effective = await getEffectiveModules(guard.schoolId);

  return NextResponse.json({
    planCode: school?.subscription?.plan?.code ?? null,
    planDefaults: planFeatures.modules,
    overrides: overrides.map((o) => ({ module: o.module, enabled: o.enabled })),
    effective,
  });
}

export async function PUT(req: Request) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const body = await parseJsonBody(req).catch(() => null);
  const module = body?.module as FeatureModule | undefined;
  const enabled = Boolean(body?.enabled);
  const ALLOWED: FeatureModule[] = [
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
  if (!module || !ALLOWED.includes(module)) {
    return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  }

  await setFeatureOverride(guard.schoolId, module, enabled);
  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "FEATURE_FLAG_CHANGED",
    category: "TENANT",
    metadata: { module, enabled },
  });
  return NextResponse.json({ ok: true, module, enabled });
}
