import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";
import { getBillingProvider } from "@/lib/saas/billing/provider";

/**
 * POST /api/billing/subscription/reactivate — cancel a pending cancellation.
 */
export async function POST() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const sub = await prisma.subscription.findUnique({ where: { schoolId: guard.schoolId } });
  if (!sub) return NextResponse.json({ error: "No subscription" }, { status: 404 });
  if (!sub.providerSubscriptionId || !sub.provider) {
    return NextResponse.json({ error: "No provider reference" }, { status: 400 });
  }

  try {
    const adapter = await getBillingProvider(sub.provider);
    await adapter.reactivate(sub.providerSubscriptionId);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: false },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Provider reactivation failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }

  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "SUBSCRIPTION_REACTIVATED",
    category: "BILLING",
  });

  return NextResponse.json({ ok: true, cancelAtPeriodEnd: false });
}
