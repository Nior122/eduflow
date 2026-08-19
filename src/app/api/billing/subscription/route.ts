import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";
import { defaultBillingProvider, getBillingProvider } from "@/lib/saas/billing/provider";
import { applyCoupon } from "@/lib/saas/billing/service";

/**
 * GET /api/billing/subscription — current subscription + plan + usage.
 * POST /api/billing/subscription — start checkout: { planCode, cycle?, couponCode? }
 */
export async function GET() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const sub = await prisma.subscription.findUnique({
    where: { schoolId: guard.schoolId },
    include: { plan: true, invoices: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  const school = await prisma.school.findUnique({
    where: { id: guard.schoolId },
    select: { name: true, email: true },
  });
  const recentInvoices = sub
    ? await prisma.billingInvoice.findMany({
        where: { schoolId: guard.schoolId },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    subscription: sub,
    school: { name: school?.name ?? "", email: school?.email ?? null },
    plans,
    recentInvoices,
  });
}

export async function POST(req: Request) {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const body = await parseJsonBody(req).catch(() => null);
  const planCode = typeof body?.planCode === "string" ? body.planCode : null;
  const cycle: "MONTHLY" | "YEARLY" = body?.cycle === "YEARLY" ? "YEARLY" : "MONTHLY";
  const couponCode = typeof body?.couponCode === "string" && body.couponCode ? body.couponCode : null;

  if (!planCode) return NextResponse.json({ error: "planCode is required" }, { status: 400 });

  const [plan, school, sub] = await Promise.all([
    prisma.subscriptionPlan.findUnique({ where: { code: planCode } }),
    prisma.school.findUnique({ where: { id: guard.schoolId }, select: { id: true, name: true, email: true } }),
    prisma.subscription.findUnique({ where: { schoolId: guard.schoolId } }),
  ]);
  if (!plan || !school) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const billingEmail = sub?.billingEmail ?? school.email ?? "";
  if (!billingEmail) {
    return NextResponse.json({ error: "Set a billing email on your school profile first" }, { status: 400 });
  }

  const coupon = couponCode
    ? await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } })
    : null;
  if (couponCode && !coupon) {
    return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
  }
  const now = new Date();
  if (coupon && (!coupon.isActive || (coupon.validFrom && coupon.validFrom > now) || (coupon.validUntil && coupon.validUntil < now) || (coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined && coupon.redemptionCount >= coupon.maxRedemptions))) {
    return NextResponse.json({ error: "Coupon is not valid" }, { status: 400 });
  }

  const priceMinor = cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
  const { totalMinor, discountMinor } = applyCoupon({
    priceMinor,
    currency: plan.currency,
    coupon,
  });

  const provider = defaultBillingProvider();
  const adapter = await getBillingProvider(provider);
  const origin = new URL(req.url).origin;
  const checkout = await adapter.createCheckout({
    provider,
    planCode: plan.code,
    planName: plan.name,
    cycle,
    amountMinor: totalMinor,
    currency: plan.currency,
    schoolId: guard.schoolId,
    schoolName: school.name,
    billingEmail,
    couponCode,
    successUrl: `${origin}/admin/subscription?checkout=success`,
    cancelUrl: `${origin}/admin/subscription?checkout=cancelled`,
  });

  if (coupon && coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined) {
    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { redemptionCount: { increment: 1 } },
    });
  }

  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "CHECKOUT_STARTED",
    category: "BILLING",
    metadata: { planCode: plan.code, cycle, totalMinor, discountMinor, provider, couponCode },
  });

  return NextResponse.json({
    checkoutUrl: checkout.checkoutUrl,
    reference: checkout.reference,
    plan: { code: plan.code, name: plan.name },
    totals: { priceMinor, discountMinor, totalMinor, currency: plan.currency },
  });
}
