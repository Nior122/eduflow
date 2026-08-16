import { NextResponse } from "next/server";
import {
  applyCheckoutCompleted,
  applyPaymentSucceeded,
  applyPaymentFailed,
  applySubscriptionStatus,
} from "@/lib/saas/billing/service";
import { getBillingProvider } from "@/lib/saas/billing/provider";
import { logger } from "@/lib/saas/logger";

/**
 * POST /api/billing/webhooks/stripe — Stripe webhook receiver.
 * Configure the endpoint secret in STRIPE_WEBHOOK_SECRET and point Stripe
 * at {APP_URL}/api/billing/webhooks/stripe.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const provider = "STRIPE";
  try {
    const adapter = await getBillingProvider(provider);
    const events = await adapter.verifyWebhook(rawBody, req.headers);
    for (const ev of events) {
      await handleEvent(ev.type, ev);
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    logger.warn("stripe webhook rejected", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }
}

async function handleEvent(type: string, ev: Parameters<typeof applyCheckoutCompleted>[0]) {
  switch (type) {
    case "checkout.completed":
      await applyCheckoutCompleted(ev);
      break;
    case "invoice.paid":
      await applyPaymentSucceeded(ev);
      break;
    case "invoice.failed":
      await applyPaymentFailed(ev);
      break;
    case "subscription.updated":
    case "subscription.canceled":
    case "subscription.active":
      await applySubscriptionStatus(ev);
      break;
    default:
      logger.debug("stripe unhandled event", { type });
  }
}
