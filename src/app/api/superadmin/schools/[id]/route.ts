import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";

/**
 * GET /api/superadmin/schools/[id] — full tenant view (subscription,
 * usage, flags, invoices, recent users).
 * PATCH — { status } | { planId, cycle } | { trialDays } — manage tenant.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const [school, usageRows, invoices, tickets, users] = await Promise.all([
    prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        website: true,
        status: true,
        onboardingComplete: true,
        createdAt: true,
        subscription: { include: { plan: true } },
      },
    }),
    prisma.usageRecord.findMany({ where: { schoolId: id } }),
    prisma.billingInvoice.findMany({ where: { schoolId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.supportTicket.findMany({ where: { schoolId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.user.findMany({
      where: { schoolId: id },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });
  return NextResponse.json({ school, usageRows, invoices, tickets, users });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const school = await prisma.school.findUnique({ where: { id }, include: { subscription: true } });
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body?.status === "ACTIVE" || body?.status === "SUSPENDED") updates.status = body.status;

  if (body?.planId && school.subscription) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: body.planId } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    const cycle = body?.cycle === "YEARLY" ? "YEARLY" : "MONTHLY";
    await prisma.subscription.update({
      where: { id: school.subscription.id },
      data: {
        planId: plan.id,
        cycle,
        amountMinor: cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly,
        currency: plan.currency,
      },
    });
    await audit({
      schoolId: id,
      actorId: guard.userId,
      action: "SUBSCRIPTION_CHANGED_BY_SUPERADMIN",
      category: "BILLING",
      metadata: { planCode: plan.code, cycle },
    });
  }

  if (body?.trialDays && typeof body.trialDays === "number" && school.subscription) {
    const trialEndsAt = new Date(Date.now() + body.trialDays * 24 * 60 * 60 * 1000);
    await prisma.subscription.update({
      where: { id: school.subscription.id },
      data: { trialEndsAt, status: "TRIALING" },
    });
  }

  if (Object.keys(updates).length > 0) {
    await prisma.school.update({ where: { id }, data: updates });
  }
  return NextResponse.json({ ok: true });
}
