// ─── Phase 9: Flutterwave adapter (fetch-based REST, no SDK) ─────────
// Flutterwave charges are one-off payments (tx_ref); recurring billing is
// handled by payment plans in the Flutterwave dashboard. The adapter
// implements checkout + webhook verification; subscription cancel/upgrade
// for Flutterwave is managed from the dashboard (see docs/BILLING.md).
import type { BillingProviderAdapter, CheckoutInput, ProviderEvent } from "./provider";

const API = "https://api.flutterwave.com/v3";

function secret(): string {
  const s = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!s) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured (see .env.example)");
  return s;
}

async function fwFetch(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(API + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flutterwave API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export const flutterwaveAdapter: BillingProviderAdapter = {
  name: "FLUTTERWAVE",

  async createCheckout(input: CheckoutInput) {
    const txRef = `ef-${input.schoolId.slice(0, 8)}-${Date.now()}`;
    const data = await fwFetch("/payments", {
      tx_ref: txRef,
      amount: (input.amountMinor / 100).toFixed(2),
      currency: input.currency,
      redirect_url: input.successUrl,
      customer: { email: input.billingEmail },
      customizations: { title: `EduFlow ${input.planName}` },
      meta: { schoolId: input.schoolId, planCode: input.planCode, cycle: input.cycle },
    });
    const link = (data.data as Record<string, unknown> | undefined)?.link;
    if (typeof link !== "string") {
      throw new Error("Flutterwave did not return a payment link");
    }
    return { checkoutUrl: link, reference: txRef };
  },

  async cancelAtPeriodEnd() {
    // Flutterwave subscriptions are paused from the dashboard (docs/BILLING.md).
  },

  async reactivate() {
    // Flutterwave subscriptions are resumed from the dashboard (docs/BILLING.md).
  },

  async verifyWebhook(rawBody: string, headers: Headers) {
    const hash = headers.get("verif-hash");
    const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    if (!hash || !expected || hash !== expected) {
      throw new Error("Invalid Flutterwave webhook hash");
    }
    const event = JSON.parse(rawBody) as {
      data?: Record<string, unknown>;
    };
    const data = event.data ?? {};
    const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
    const meta = (data.meta ?? {}) as Record<string, unknown>;
    const customer = (data.customer ?? {}) as Record<string, unknown>;

    const map: Record<string, string> = {
      successful: "invoice.paid",
      failed: "invoice.failed",
      cancelled: "invoice.failed",
    };

    return [
      {
        provider: "FLUTTERWAVE",
        type: map[status] ?? "subscription.updated",
        providerSubscriptionId:
          data.id !== null && data.id !== undefined ? String(data.id) : null,
        providerCustomerId:
          customer.id !== null && customer.id !== undefined ? String(customer.id) : null,
        providerInvoiceId: null,
        schoolId: typeof meta.schoolId === "string" ? meta.schoolId : null,
        planCode: typeof meta.planCode === "string" ? meta.planCode : null,
        amountMinor: typeof data.amount === "number" ? Math.round(data.amount * 100) : null,
        currency: typeof data.currency === "string" ? data.currency : null,
        periodEnd: null,
        raw: event,
      } satisfies ProviderEvent,
    ];
  },
};
