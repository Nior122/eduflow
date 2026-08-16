# EduFlow — Developer Guide (Phase 9)

## Conventions

- **All new API routes** start with the unified guard:

```ts
import { NextResponse } from "next/server";
import { apiGuard } from "@/lib/saas/guard";

export async function GET() {
  const guard = await apiGuard({ roles: ["SCHOOL_ADMIN"], schoolScoped: true });
  if (guard instanceof NextResponse) return guard;
  // guard.schoolId / guard.userId / guard.role available
}
```

Options: `roles` (UserRole[]), `feature` (FeatureModule — 403 when the
school's effective modules don't include it), `schoolScoped` (requires a
school context; SUPER_ADMIN without a school is rejected unless you handle
it explicitly).

- **Tenant-scoped queries**: always filter by `guard.schoolId`. When a model
  has no `schoolId` (e.g. `Attendance`, `Result`), scope through a relation
  (`where: { student: { schoolId } }`).
- **Cross-tenant checks**: `assertTenantAccess(session, targetSchoolId)`
  from `@/lib/saas/tenant`.
- **Errors**: return `NextResponse.json({ error: "..." }, { status })`.
  Use `ApiError` + `fail()` from `@/lib/saas/api` in v1 routes.
- **Audit** notable actions: `audit({ schoolId, actorId, action, category, metadata })`.
- **Log** structured: `logger.info/warn/error(msg, fields)`.

## Plan limits & usage

- Limits live in `SubscriptionPlan.features` (see `src/lib/saas/plans.ts`).
- Meter with `recordUsage(schoolId, metric, amount)`; check with
  `checkUsageLimit(schoolId, metric, limitKey)` before creating
  students/teachers or consuming quota.
- Add a new meter: extend `UsageMetric` enum, record at the action site,
  surface it in `/api/billing/usage` and the subscription page.

## Feature flags

- Registry: `FeatureModule` enum + `MODULE_LABELS` in the features page.
- Read effective state: `canUseModule(schoolId, "AI")` or
  `getEffectiveModules(schoolId)`.
- Enforcement: `apiGuard({ feature: "AI" })` — middleware cannot check
  flags (edge, no DB), so enforcement happens in routes; the middleware
  gate is only defense-in-depth.

## Adding a webhook event

1. Add the event name to `src/lib/saas/events.ts` (`WEBHOOK_EVENTS`).
2. Call `queueWebhookEvent({ schoolId, event: "student.created", payload })`
   at the moment of change. Retries are automatic (cron).

## Billing

- Providers implement `BillingProviderAdapter` (`src/lib/saas/billing/provider.ts`):
  `createCheckout`, `cancelAtPeriodEnd`, `reactivate`, `verifyWebhook`.
- Webhook events are normalized to `ProviderEvent` and applied by
  `src/lib/saas/billing/service.ts` (`applyCheckoutCompleted`,
  `applyPaymentSucceeded`, `applyPaymentFailed`, `applySubscriptionStatus`).
- Adding a provider: implement the adapter, export it from
  `getBillingProvider`, add the webhook route under
  `/api/billing/webhooks/<name>`, document setup in `docs/BILLING.md`.
- Money: integer minor units everywhere (`amountMinor`), format with
  `minorToMajor()`.

## Email & storage

- `sendSaaSEmail({ to, subject, template, data })` — templates in
  `src/lib/saas/email/templates.ts`; every send is logged to `EmailLog`.
- Storage adapter: `getStorageAdapter()` → `local` (dev) or `cloudinary`
  (prod). Uploads through the app should go via `src/app/api/upload/route.ts`
  so the storage quota is enforced.

## Cron

Add tasks to `/api/cron/daily` (trial expiry, past-due, overdue invoices,
webhook retries). Protect anything new with the `CRON_SECRET` bearer check.
Schedule: `vercel.json` (daily 03:00 UTC).

## Tests

- `npm test` runs vitest (`src/lib/saas/__tests__/*`).
- Keep tests pure (no DB): test plans/limits math, coupon math, tenant
  guard decisions, API-key hashing, webhook signing, pagination helpers.
- Tenant isolation E2E: `BASE_URL=... scripts/verify-tenant-isolation.sh`.

## Migrations

- Add models/fields to `prisma/schema.prisma`, then
  `npx prisma migrate dev --name <phase>` (local) and `npm run db:deploy`
  (production). Never commit a migration that touches another tenant's
  data semantics without a plan for the rollout.
