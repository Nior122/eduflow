// ─── Phase 9: billing service — applies provider events to the DB ────
import { prisma } from "@/lib/db";
import type { BillingInvoiceStatus, BillingProvider, SubscriptionStatus } from "@prisma/client";
import type { ProviderEvent } from "./provider";
import { audit } from "../audit";
import { sendSaaSEmail } from "../email/send";
import { sendAlert } from "../alerts";
import { logger } from "../logger";

export function generateInvoiceNumber(): string {
  const d = new Date();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `EF-${d.getUTCFullYear()}-${rand}`;
}

/** Coupon math — pure, unit-tested. */
export function applyCoupon(input: {
  priceMinor: number;
  currency: string;
  coupon?: {
    discountType: "PERCENT" | "FIXED";
    discountValue: number;
    currency?: string | null;
  } | null;
}): { totalMinor: number; discountMinor: number } {
  if (!input.coupon) return { totalMinor: input.priceMinor, discountMinor: 0 };
  if (input.coupon.discountType === "PERCENT") {
    const pct = Math.min(100, Math.max(0, input.coupon.discountValue));
    const discount = Math.round((input.priceMinor * pct) / 100);
    return { totalMinor: Math.max(0, input.priceMinor - discount), discountMinor: discount };
  }
  const discount = Math.min(input.priceMinor, input.coupon.discountValue);
  return { totalMinor: Math.max(0, input.priceMinor - discount), discountMinor: discount };
}

export async function getSubscriptionForSchool(schoolId: string) {
  return prisma.subscription.findUnique({
    where: { schoolId },
    include: { plan: true },
  });
}

/** checkout.completed → activate subscription + open a platform invoice. */
export async function applyCheckoutCompleted(ev: ProviderEvent) {
  const schoolId = ev.schoolId;
  if (!schoolId) return;
  const plan = ev.planCode
    ? await prisma.subscriptionPlan.findUnique({ where: { code: ev.planCode } })
    : null;
  const sub = await prisma.subscription.findUnique({ where: { schoolId } });
  const planId = plan?.id ?? sub?.planId;
  if (!planId) return;

  const updated = await prisma.subscription.upsert({
    where: { schoolId },
    update: {
      status: "ACTIVE" as SubscriptionStatus,
      provider: ev.provider as BillingProvider,
      providerSubscriptionId: ev.providerSubscriptionId ?? sub?.providerSubscriptionId,
      providerCustomerId: ev.providerCustomerId ?? sub?.providerCustomerId,
      planId,
      amountMinor: ev.amountMinor ?? sub?.amountMinor ?? 0,
      currency: ev.currency ?? sub?.currency ?? "USD",
      currentPeriodStart: new Date(),
      currentPeriodEnd: ev.periodEnd,
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      nextPaymentDate: ev.periodEnd,
    },
    create: {
      schoolId,
      planId,
      status: "ACTIVE" as SubscriptionStatus,
      provider: ev.provider as BillingProvider,
      providerSubscriptionId: ev.providerSubscriptionId,
      providerCustomerId: ev.providerCustomerId,
      amountMinor: ev.amountMinor ?? 0,
      currency: ev.currency ?? "USD",
      currentPeriodStart: new Date(),
      currentPeriodEnd: ev.periodEnd,
      nextPaymentDate: ev.periodEnd,
    },
  });

  await prisma.billingInvoice.create({
    data: {
      number: generateInvoiceNumber(),
      schoolId,
      subscriptionId: updated.id,
      status: "OPEN" as BillingInvoiceStatus,
      amountMinor: ev.amountMinor ?? 0,
      currency: ev.currency ?? "USD",
      provider: ev.provider as BillingProvider,
      providerInvoiceId: ev.providerInvoiceId,
      periodStart: updated.currentPeriodStart,
      periodEnd: ev.periodEnd,
      dueDate: ev.periodEnd,
    },
  });

  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
  await audit({ schoolId, action: "CHECKOUT_COMPLETED", category: "BILLING", metadata: { provider: ev.provider, planCode: ev.planCode } });
  if (updated.billingEmail) {
    await sendSaaSEmail({
      to: updated.billingEmail,
      subject: `Welcome to EduFlow ${plan?.name ?? ""} — payment received`,
      template: "welcome",
      data: { schoolName: school?.name ?? "your school", planName: plan?.name ?? "" },
    });
  }
}

/** invoice.paid → mark the matching invoice paid + refresh period end. */
export async function applyPaymentSucceeded(ev: ProviderEvent) {
  const schoolId = ev.schoolId;
  if (!schoolId) return;
  const sub = await prisma.subscription.findUnique({ where: { schoolId } });
  if (!sub) return;

  const inv = ev.providerInvoiceId
    ? await prisma.billingInvoice.findFirst({
        where: { schoolId, providerInvoiceId: ev.providerInvoiceId },
      })
    : await prisma.billingInvoice.findFirst({
        where: { schoolId, subscriptionId: sub.id, status: "OPEN" },
        orderBy: { createdAt: "desc" },
      });

  if (inv) {
    await prisma.billingInvoice.update({
      where: { id: inv.id },
      data: {
        status: "PAID" as BillingInvoiceStatus,
        paidAt: new Date(),
        amountMinor: ev.amountMinor ?? inv.amountMinor,
        currency: ev.currency ?? inv.currency,
      },
    });
    if (sub.billingEmail) {
      await sendSaaSEmail({
        to: sub.billingEmail,
        subject: `Receipt ${inv.number}`,
        template: "receipt",
        data: {
          invoiceNumber: inv.number,
          amountMinor: ev.amountMinor ?? inv.amountMinor,
          currency: ev.currency ?? inv.currency,
        },
      });
    }
  }

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "ACTIVE" as SubscriptionStatus, currentPeriodEnd: ev.periodEnd ?? sub.currentPeriodEnd },
  });
  await audit({ schoolId, action: "PAYMENT_SUCCEEDED", category: "BILLING", metadata: { amountMinor: ev.amountMinor, invoice: inv?.number } });
}

/** invoice.payment_failed → mark invoice failed, subscription past due, alert. */
export async function applyPaymentFailed(ev: ProviderEvent) {
  const schoolId = ev.schoolId;
  if (!schoolId) return;
  const sub = await prisma.subscription.findUnique({ where: { schoolId } });
  if (!sub) return;

  const inv = await prisma.billingInvoice.findFirst({
    where: { schoolId, subscriptionId: sub.id, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  if (inv) {
    await prisma.billingInvoice.update({
      where: { id: inv.id },
      data: { status: "FAILED" as BillingInvoiceStatus },
    });
  }
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE" as SubscriptionStatus } });

  if (sub.billingEmail) {
    await sendSaaSEmail({
      to: sub.billingEmail,
      subject: "Payment failed — your EduFlow subscription needs attention",
      template: "paymentFailed",
      data: {},
    });
  }
  await sendAlert({
    title: "Subscription payment failed",
    message: `School ${schoolId} — billing email ${sub.billingEmail ?? "n/a"}`,
    level: "warn",
  });
  await audit({ schoolId, action: "PAYMENT_FAILED", category: "BILLING" });
}

/** subscription.updated / .canceled / .active → sync status. */
export async function applySubscriptionStatus(ev: ProviderEvent) {
  const schoolId = ev.schoolId;
  if (!schoolId) return;
  const sub = await prisma.subscription.findUnique({ where: { schoolId } });
  if (!sub) return;

  const raw = ev.raw as { data?: { object?: { status?: string } } };
  const providerStatus = raw?.data?.object?.status ?? null;

  let next: SubscriptionStatus = sub.status;
  if (ev.type === "subscription.canceled") next = "CANCELED";
  else if (providerStatus === "canceled") next = "CANCELED";
  else if (providerStatus === "past_due") next = "PAST_DUE";
  else if (providerStatus === "active") next = "ACTIVE";
  else if (providerStatus === "trialing") next = "TRIALING";
  else if (ev.type === "subscription.active") next = "ACTIVE";

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: next,
      currentPeriodEnd: ev.periodEnd ?? sub.currentPeriodEnd,
      providerSubscriptionId: ev.providerSubscriptionId ?? sub.providerSubscriptionId,
      providerCustomerId: ev.providerCustomerId ?? sub.providerCustomerId,
    },
  });
  await audit({
    schoolId,
    action: "SUBSCRIPTION_STATUS",
    category: "BILLING",
    metadata: { status: next, providerStatus },
  });
  logger.info("subscription status changed", { schoolId, status: next });
}
