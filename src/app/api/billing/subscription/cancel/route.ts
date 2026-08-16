import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { audit } from "@/lib/saas/audit";
import { getBillingProvider } from "@/lib/saas/billing/provider";
import { sendSaaSEmail } from "@/lib/saas/email/send";

/**
 * POST /api/billing/subscription/cancel — cancel at period end (Stripe) or
 * disable (Paystack). Flutterwave is managed from its dashboard.
 */
export async function POST() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;

  const sub = await prisma.subscription.findUnique({ where: { schoolId: guard.schoolId } });
  if (!sub) return NextResponse.json({ error: "No subscription" }, { status: 404 });
  if (!sub.providerSubscriptionId || !sub.provider) {
    return NextResponse.json(
      { error: "This subscription has no provider reference — contact support" },
      { status: 400 }
    );
  }

  try {
    const adapter = await getBillingProvider(sub.provider);
    await adapter.cancelAtPeriodEnd(sub.providerSubscriptionId);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Provider cancellation failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }

  await audit({
    schoolId: guard.schoolId,
    actorId: guard.userId,
    action: "SUBSCRIPTION_CANCEL_REQUESTED",
    category: "BILLING",
  });
  if (sub.billingEmail) {
    await sendSaaSEmail({
      to: sub.billingEmail,
      subject: "Subscription cancellation requested",
      template: "subscriptionCanceled",
      data: {},
    });
  }

  return NextResponse.json({ ok: true, cancelAtPeriodEnd: true });
}
