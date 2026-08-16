// ─── Phase 9: Stripe adapter (fetch-based REST, no SDK) ──────────────
import { createHmac } from "crypto";
import type { BillingProviderAdapter, CheckoutInput, ProviderEvent } from "./provider";

const API = "https://api.stripe.com/v1";

function secret(): string {
  const s = process.env.STRIPE_SECRET_KEY;
  if (!s) throw new Error("STRIPE_SECRET_KEY is not configured (see .env.example)");
  return s;
}

async function stripeFetch(
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(API + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export const stripeAdapter: BillingProviderAdapter = {
  name: "STRIPE",

  async createCheckout(input: CheckoutInput) {
    const params: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(input.amountMinor),
      "line_items[0][price_data][product_data][name]": `EduFlow ${input.planName} (${input.cycle.toLowerCase()})`,
      "line_items[0][price_data][recurring][interval]": input.cycle === "YEARLY" ? "year" : "month",
      "line_items[0][quantity]": "1",
      client_reference_id: input.schoolId,
      "subscription_data[metadata][schoolId]": input.schoolId,
      "subscription_data[metadata][planCode]": input.planCode,
      customer_email: input.billingEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    };
    if (input.couponCode) params["discounts[0][coupon]"] = input.couponCode;
    const data = await stripeFetch("/checkout/sessions", params);
    const url = typeof data.url === "string" ? data.url : null;
    if (!url) throw new Error("Stripe checkout did not return a URL");
    return { checkoutUrl: url, reference: String(data.id ?? "") };
  },

  async cancelAtPeriodEnd(providerSubscriptionId: string) {
    await stripeFetch(`/subscriptions/${providerSubscriptionId}`, { cancel_at_period_end: "true" });
  },

  async reactivate(providerSubscriptionId: string) {
    await stripeFetch(`/subscriptions/${providerSubscriptionId}`, { cancel_at_period_end: "false" });
  },

  async verifyWebhook(rawBody: string, headers: Headers) {
    const signature = headers.get("stripe-signature");
    const secretValue = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secretValue) {
      throw new Error("Missing Stripe signature or STRIPE_WEBHOOK_SECRET");
    }
    const parts = Object.fromEntries(
      signature.split(",").map((p) => p.split("=", 2) as [string, string])
    );
    const expected = createHmac("sha256", secretValue)
      .update(`${parts.t ?? ""}.${rawBody}`)
      .digest("hex");
    if (parts.v1 !== expected) throw new Error("Invalid Stripe signature");

    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
    const obj = event.data?.object ?? {};
    const type = event.type ?? "unknown";
    const periodEnd =
      typeof obj.current_period_end === "number" ? new Date(obj.current_period_end * 1000) : null;
    const metadata = (obj.metadata ?? {}) as Record<string, unknown>;

    const ev: ProviderEvent = {
      provider: "STRIPE",
      type: mapStripeEvent(type),
      providerSubscriptionId:
        typeof obj.subscription === "string"
          ? obj.subscription
          : type.startsWith("customer.subscription") && typeof obj.id === "string"
            ? String(obj.id)
            : null,
      providerCustomerId: typeof obj.customer === "string" ? obj.customer : null,
      providerInvoiceId:
        type.startsWith("invoice") && typeof obj.id === "string" ? String(obj.id) : null,
      schoolId:
        typeof metadata.schoolId === "string"
          ? metadata.schoolId
          : typeof obj.client_reference_id === "string"
            ? obj.client_reference_id
            : null,
      planCode: typeof metadata.planCode === "string" ? metadata.planCode : null,
      amountMinor:
        typeof obj.amount_paid === "number"
          ? obj.amount_paid
          : typeof obj.amount_due === "number"
            ? obj.amount_due
            : null,
      currency: typeof obj.currency === "string" ? obj.currency.toUpperCase() : null,
      periodEnd,
      raw: event,
    };
    return [ev];
  },
};

function mapStripeEvent(type: string): string {
  switch (type) {
    case "checkout.session.completed":
      return "checkout.completed";
    case "invoice.paid":
      return "invoice.paid";
    case "invoice.payment_failed":
      return "invoice.failed";
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return "subscription.updated";
    case "customer.subscription.deleted":
      return "subscription.canceled";
    default:
      return type;
  }
}
