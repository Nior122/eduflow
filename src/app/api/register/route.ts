// ─── Phase 9: SaaS registration — school + admin + trial subscription ─
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { validate, registerSchoolSchema } from "@/lib/validations";
import { rateLimit, ipKey } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";
import { audit } from "@/lib/saas/audit";
import { sendSaaSEmail } from "@/lib/saas/email/send";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ipKey(ip, "register"), { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    // Registration can be paused platform-wide from the super admin portal.
    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } });
    if (settings && !settings.allowRegistration) {
      return NextResponse.json({ error: "New registrations are currently paused" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = validate(registerSchoolSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { name, email, password, schoolName } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const slug = generateSlug(schoolName) + "-" + Date.now().toString(36);

    const trialDays = settings?.defaultTrialDays ?? 14;
    const planCode = settings?.defaultPlanCode ?? "STARTER";
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: planCode } });
    if (!plan) {
      return NextResponse.json(
        { error: "Default subscription plan is not configured" },
        { status: 500 }
      );
    }
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    // School + admin + trial subscription + onboarding state — one transaction.
    const { user, school } = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({ data: { name: schoolName, slug } });
      const user = await tx.user.create({
        data: { name, email, passwordHash, role: "SCHOOL_ADMIN", schoolId: school.id },
      });
      await tx.subscription.create({
        data: {
          schoolId: school.id,
          planId: plan.id,
          status: "TRIALING",
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
          billingEmail: email,
          amountMinor: plan.priceMonthly,
          currency: plan.currency,
        },
      });
      await tx.schoolOnboarding.create({
        data: { schoolId: school.id, currentStep: 1, steps: {} },
      });
      return { user, school };
    });

    await audit({
      schoolId: school.id,
      actorId: user.id,
      action: "SCHOOL_REGISTERED",
      category: "TENANT",
      metadata: { planCode: plan.code, trialDays },
    });
    await sendSaaSEmail({
      to: email,
      subject: `Welcome to EduFlow — ${school.name}`,
      template: "welcome",
      data: { schoolName: school.name, planName: plan.name },
    });

    return NextResponse.json(
      {
        user: { id: user.id, name: user.name, email: user.email },
        school: { id: school.id, name: school.name },
        subscription: { plan: plan.code, trialDays, trialEndsAt },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
