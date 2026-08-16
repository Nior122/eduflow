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
 * POST /api/billing/webhooks/flutterwave — Flutterwave webhook receiver.
 * Set the webhook hash in FLUTTERWAVE_WEBHOOK_HASH (must match the
 * dashboard `verif-hash` secret).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const provider = "FLUTTERWAVE";
  try {
    const adapter = await getBillingProvider(provider);
    const events = await adapter.verifyWebhook(rawBody, req.headers);
    for (const ev of events) {
      if (ev.type === "invoice.paid") await applyPaymentSucceeded(ev);
      else if (ev.type === "invoice.failed") await applyPaymentFailed(ev);
      else if (ev.type.startsWith("subscription.")) await applySubscriptionStatus(ev);
      else if (ev.type === "checkout.completed") await applyCheckoutCompleted(ev);
      else logger.debug("flutterwave unhandled event", { type: ev.type });
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    logger.warn("flutterwave webhook rejected", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }
}
