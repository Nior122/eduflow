// ─── Phase 9: Paystack adapter (fetch-based REST, no SDK) ────────────
// Paystack subscription flow: recurring charges are driven by a *plan*
// that must exist in the Paystack dashboard with a code matching the
// EduFlow plan code (e.g. `starter`). See docs/BILLING.md.
import { createHmac } from "crypto";
import type { BillingProviderAdapter, CheckoutInput, ProviderEvent } from "./provider";

const API = "https://api.paystack.co";

function secret(): string {
  const s = process.env.PAYSTACK_SECRET_KEY;
  if (!s) throw new Error("PAYSTACK_SECRET_KEY is not configured (see .env.example)");
  return s;
}

async function paystackFetch(
  path: string,
  init: { method: string; body?: string }
): Promise<Record<string, unknown>> {
  const res = await fetch(API + path, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
    },
    body: init.body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paystack API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export const paystackAdapter: BillingProviderAdapter = {
  name: "PAYSTACK",

  async createCheckout(input: CheckoutInput) {
    const planCode = input.planCode.toLowerCase();
    const data = await paystackFetch("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.billingEmail,
        amount: String(input.amountMinor), // kobo
        plan: planCode,
        currency: input.currency,
        callback_url: input.successUrl,
        metadata: {
          schoolId: input.schoolId,
          planCode: input.planCode,
          cycle: input.cycle,
        },
      }),
    });
    const url = (data.data as Record<string, unknown> | undefined)?.authorization_url;
    if (typeof url !== "string") {
      throw new Error(
        "Paystack did not return an authorization_url. Create a plan with code '" +
          planCode +
          "' in the Paystack dashboard first (see docs/BILLING.md)."
      );
    }
    const reference = (data.data as Record<string, unknown> | undefined)?.reference;
    return {
      checkoutUrl: url,
      reference: typeof reference === "string" ? reference : "",
    };
  },

  async cancelAtPeriodEnd(providerSubscriptionId: string) {
    await paystackFetch(`/subscription/${providerSubscriptionId}/disable`, {
      method: "POST",
      body: JSON.stringify({ code: providerSubscriptionId }),
    });
  },

  async reactivate(providerSubscriptionId: string) {
    await paystackFetch(`/subscription/${providerSubscriptionId}/enable`, {
      method: "POST",
      body: JSON.stringify({ code: providerSubscriptionId }),
    });
  },

  async verifyWebhook(rawBody: string, headers: Headers) {
    const sig = headers.get("x-paystack-signature");
    const secretValue = process.env.PAYSTACK_SECRET_KEY;
    if (!sig || !secretValue) throw new Error("Missing Paystack signature");
    const expected = createHmac("sha512", secretValue).update(rawBody).digest("hex");
    if (sig !== expected) throw new Error("Invalid Paystack signature");

    const event = JSON.parse(rawBody) as {
      event?: string;
      data?: Record<string, unknown>;
    };
    const evName = event.event ?? "unknown";
    const data = event.data ?? {};
    const customer = (data.customer ?? {}) as Record<string, unknown>;
    const plan = (data.plan ?? {}) as Record<string, unknown>;
    const metadata = (data.metadata ?? {}) as Record<string, unknown>;

    const map: Record<string, string> = {
      "subscription.create": "subscription.active",
      "subscription.disable": "subscription.canceled",
      "charge.success": "invoice.paid",
      "invoice.create": "invoice.open",
      "invoice.payment_failed": "invoice.failed",
    };

    return [
      {
        provider: "PAYSTACK",
        type: map[evName] ?? evName,
        providerSubscriptionId:
          typeof data.subscription_code === "string" ? data.subscription_code : null,
        providerCustomerId:
          typeof data.customer_code === "string"
            ? data.customer_code
            : typeof customer.customer_code === "string"
              ? customer.customer_code
              : null,
        providerInvoiceId:
          typeof data.invoice_code === "string"
            ? data.invoice_code
            : data.id !== null && data.id !== undefined
              ? String(data.id)
              : null,
        schoolId: typeof metadata.schoolId === "string" ? metadata.schoolId : null,
        planCode:
          typeof plan.plan_code === "string"
            ? plan.plan_code
            : typeof metadata.planCode === "string"
              ? metadata.planCode
              : null,
        amountMinor: typeof data.amount === "number" ? data.amount : null,
        currency: typeof data.currency === "string" ? data.currency : null,
        periodEnd: null,
        raw: event,
      } satisfies ProviderEvent,
    ];
  },
};
