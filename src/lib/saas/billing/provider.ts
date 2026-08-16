// ─── Phase 9: subscription billing provider abstraction ──────────────
// All billing routes talk to this interface only. Concrete adapters are
// fetch-based REST clients (no SDK dependencies) — see ./stripe.ts,
// ./paystack.ts, ./flutterwave.ts. Providers refuse loudly when their
// keys are missing; nothing is silently mocked.

export type BillingProviderName = "STRIPE" | "PAYSTACK" | "FLUTTERWAVE";

export interface CheckoutInput {
  provider: BillingProviderName;
  planCode: string;
  planName: string;
  cycle: "MONTHLY" | "YEARLY";
  amountMinor: number;
  currency: string;
  schoolId: string;
  schoolName: string;
  billingEmail: string;
  couponCode?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  reference: string;
}

/** Normalized provider event (provider-agnostic shape). */
export interface ProviderEvent {
  provider: BillingProviderName;
  type: string;
  // normalized: checkout.completed | invoice.open | invoice.paid |
  // invoice.failed | subscription.active | subscription.updated |
  // subscription.canceled | subscription.past_due
  providerSubscriptionId?: string | null;
  providerCustomerId?: string | null;
  providerInvoiceId?: string | null;
  schoolId?: string | null;
  planCode?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  periodEnd?: Date | null;
  raw: unknown;
}

export interface BillingProviderAdapter {
  name: BillingProviderName;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  cancelAtPeriodEnd(providerSubscriptionId: string): Promise<void>;
  reactivate(providerSubscriptionId: string): Promise<void>;
  /** Verify webhook authenticity and return normalized events. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent[]>;
}

export async function getBillingProvider(
  provider: BillingProviderName
): Promise<BillingProviderAdapter> {
  if (provider === "STRIPE") return (await import("./stripe")).stripeAdapter;
  if (provider === "PAYSTACK") return (await import("./paystack")).paystackAdapter;
  return (await import("./flutterwave")).flutterwaveAdapter;
}

/** Default provider for new checkouts (env, default Stripe). */
export function defaultBillingProvider(): BillingProviderName {
  const p = (process.env.BILLING_PROVIDER ?? "stripe").toUpperCase();
  return p === "PAYSTACK" || p === "FLUTTERWAVE" ? p : "STRIPE";
}
