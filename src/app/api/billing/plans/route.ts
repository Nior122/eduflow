import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/billing/plans — public pricing list (used by /pricing and the
 * subscription upgrade UI). Never exposes provider secrets.
 */
export async function GET() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      priceMonthly: true,
      priceYearly: true,
      currency: true,
      features: true,
    },
  });
  return NextResponse.json({ plans });
}
