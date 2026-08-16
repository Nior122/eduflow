# EduFlow — Billing Setup Guide (Phase 9)

All three providers are implemented as fetch-based REST clients (no SDKs).
Pick one provider: set `BILLING_PROVIDER=stripe|paystack|flutterwave`.
Amounts are minor units (cents/kobo); EduFlow plans default to USD.

## Stripe (recommended, full subscription lifecycle)

1. Create an account at dashboard.stripe.com (test mode first).
2. Environment:
   - `STRIPE_SECRET_KEY` — `sk_test_...` (Developers → API keys).
   - `STRIPE_WEBHOOK_SECRET` — `whsec_...` (see step 4).
3. Webhook: Developers → Webhooks → Add endpoint:
   - URL: `https://<app>/api/billing/webhooks/stripe`
   - Events: `checkout.session.completed`, `invoice.paid`,
     `invoice.payment_failed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`.
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Coupons: EduFlow coupons apply at checkout via `discounts[0][coupon]`;
   create a coupon with the **same code** in Stripe (Products → Coupons)
   for it to resolve.
5. Proration on plan changes: EduFlow sends the new checkout; Stripe's
   `subscription_data` handles the switch. For in-place upgrades, add
   `proration_behavior: create_prorations` to `stripe.ts` if desired.

## Paystack

1. Dashboard → Settings → API Keys & Webhooks:
   - `PAYSTACK_SECRET_KEY` — `sk_test_...`.
   - Webhook URL: `https://<app>/api/billing/webhooks/paystack`
   - Events: enable `subscription.create`, `subscription.disable`,
     `charge.success`, `invoice.create`, `invoice.payment_failed`.
2. **Create a recurring plan per EduFlow plan** (Paystack dashboard →
   Plans → Create) with `code` matching the EduFlow plan code lowercased:
   `starter`, `professional`, `business`, `enterprise` (the adapter sends
   `plan: <code>` on `transaction/initialize`; without a matching plan it
   fails loudly).
3. Currency: Paystack supports NGN/GHS/ZAR/USD — set the plan currency in
   both places.

## Flutterwave

1. Dashboard → Settings → API: `FLUTTERWAVE_SECRET_KEY`
   (`FLWSECK_TEST-...`).
2. Webhook: Settings → Webhooks → URL:
   `https://<app>/api/billing/webhooks/flutterwave`; Flutterwave sets a
   `verif-hash` — copy it into `FLUTTERWAVE_WEBHOOK_HASH` (the adapter
   compares this header directly).
3. Checkout uses one-off payments (tx_ref) with `meta.schoolId/planCode`;
   **recurring billing is handled by Flutterwave payment plans** — create a
   payment plan in the dashboard per EduFlow plan and connect it to the
   checkout flow if you need auto-renewal (the adapter notes this in code).
4. Currency: set per payment (NGN/GHS/KES/USD supported).

## Webhook testing

- Stripe: Developers → Webhooks → "Send test event" (e.g.
  `checkout.session.completed`) → expect a 200 and the school's
  subscription flipping to ACTIVE with an OPEN invoice.
- Paystack: dashboard → Test webhook for `charge.success`.
- Flutterwave: dashboard → test webhook for a successful charge.

## Invoices & receipts

- Every checkout creates a `BillingInvoice` (number `EF-YYYY-XXXXXX`);
  paid invoices email a receipt (`templates.receipt`).
- Failed payments: invoice → FAILED, subscription → PAST_DUE, alert to
  `ALERT_WEBHOOK_URL`, reminder email to the billing address.

## Coupons

Created in `/superadmin/coupons` (percent or fixed minor units, redemptions
cap, validity window). Schools enter the code on the subscription page
before checkout. Stripe needs a matching coupon in its dashboard (above).

## Money & proration notes

- Minor units everywhere in Phase 9 models; `Decimal(10,2)` remains in the
  school fee models — convert at the boundary.
- Proration: Stripe handles it natively on subscription updates; Paystack
  prorates on plan changes via its API; Flutterwave requires a dashboard
  plan switch (documented per-adapter).
