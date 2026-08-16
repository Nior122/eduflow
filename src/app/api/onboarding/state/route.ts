import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";

/**
 * GET /api/onboarding/state — current onboarding progress + school basics.
 * School admin only. The wizard renders from this.
 */
export async function GET() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const [onboarding, school, subscription] = await Promise.all([
    prisma.schoolOnboarding.findUnique({ where: { schoolId: guard.schoolId } }),
    prisma.school.findUnique({
      where: { id: guard.schoolId },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        logo: true,
        motto: true,
        category: true,
        gradeSystem: true,
        onboardingStep: true,
        onboardingComplete: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { schoolId: guard.schoolId },
      select: { status: true, trialEndsAt: true, plan: { select: { name: true, code: true } } },
    }),
  ]);

  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  return NextResponse.json({
    onboarding: onboarding ?? { currentStep: 1, steps: {}, isComplete: false },
    school,
    subscription,
  });
}
