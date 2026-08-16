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
 * POST /api/billing/webhooks/paystack — Paystack webhook receiver.
 * Point Paystack at {APP_URL}/api/billing/webhooks/paystack. Signatures
 * are verified with PAYSTACK_SECRET_KEY (HMAC-SHA512).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const provider = "PAYSTACK";
  try {
    const adapter = await getBillingProvider(provider);
    const events = await adapter.verifyWebhook(rawBody, req.headers);
    for (const ev of events) {
      if (ev.type === "checkout.completed") await applyCheckoutCompleted(ev);
      else if (ev.type === "invoice.paid") await applyPaymentSucceeded(ev);
      else if (ev.type === "invoice.failed") await applyPaymentFailed(ev);
      else if (ev.type.startsWith("subscription.")) await applySubscriptionStatus(ev);
      else logger.debug("paystack unhandled event", { type: ev.type });
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    logger.warn("paystack webhook rejected", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }
}
