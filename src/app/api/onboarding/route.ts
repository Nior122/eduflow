import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";
import { sendSaaSEmail } from "@/lib/saas/email/send";

const STEP_1_FIELDS = [
  "name",
  "address",
  "phone",
  "email",
  "website",
  "logo",
  "motto",
  "category",
  "gradeSystem",
] as const;

/**
 * PUT /api/onboarding — save one wizard step.
 * Body: { step: 1..6, data: object }
 * Step 1 (school info) also updates the School record; other steps are
 * stored in the onboarding `steps` Json map.
 */
export async function PUT(req: Request) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const step = Number(body?.step);
  const data = (body?.data ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(step) || step < 1 || step > 6) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "Invalid step data" }, { status: 400 });
  }

  const onboarding = await prisma.schoolOnboarding.upsert({
    where: { schoolId: guard.schoolId },
    update: {},
    create: { schoolId: guard.schoolId, currentStep: 1, steps: {} },
  });

  const steps = ((onboarding.steps as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;
  steps[String(step)] = { done: true, data, updatedAt: new Date().toISOString() };
  const nextStep = Math.max(onboarding.currentStep, Math.min(step + 1, 7));

  // Step 1 carries school profile fields → persist on the School row.
  if (step === 1) {
    const schoolData: Record<string, unknown> = {};
    for (const f of STEP_1_FIELDS) {
      if (data[f] !== undefined && data[f] !== null) schoolData[f] = data[f];
    }
    await prisma.school.update({ where: { id: guard.schoolId }, data: schoolData });
  }

  await prisma.schoolOnboarding.update({
    where: { id: onboarding.id },
    data: { steps: steps as object, currentStep: nextStep },
  });

  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: `ONBOARDING_STEP_${step}`,
    category: "ONBOARDING",
  });

  return NextResponse.json({ ok: true, currentStep: nextStep });
}

/**
 * POST /api/onboarding — mark onboarding complete.
 */
export async function POST() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const onboarding = await prisma.schoolOnboarding.findUnique({
    where: { schoolId: guard.schoolId },
  });
  if (!onboarding) {
    return NextResponse.json({ error: "Onboarding not started" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.schoolOnboarding.update({
      where: { id: onboarding.id },
      data: { isComplete: true, completedAt: new Date() },
    }),
    prisma.school.update({
      where: { id: guard.schoolId },
      data: { onboardingComplete: true },
    }),
  ]);

  const school = await prisma.school.findUnique({ where: { id: guard.schoolId }, select: { name: true } });
  const admin = await prisma.user.findUnique({ where: { id: guard.userId }, select: { email: true } });

  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "ONBOARDING_COMPLETE",
    category: "ONBOARDING",
  });
  if (admin?.email) {
    await sendSaaSEmail({
      to: admin.email,
      subject: "Your school is ready on EduFlow 🎉",
      template: "welcome",
      data: { schoolName: school?.name ?? "your school", planName: "" },
    });
  }

  return NextResponse.json({ ok: true });
}
