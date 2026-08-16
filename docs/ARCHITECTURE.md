# EduFlow — Phase 9 Architecture

## 1. Multi-tenancy model

**The tenant is the `School` row.** Every domain table already carries
`schoolId` (built in Phases 1–8), so Phase 9 adds the SaaS machinery around it
without a data rewrite:

```
School (tenant)
 ├── Subscription ── SubscriptionPlan (Starter / Professional / Business / Enterprise)
 ├── SchoolOnboarding (wizard progress)
 ├── FeatureFlag[] (per-school module overrides)
 ├── UsageRecord[] (counters per metric per YYYY-MM)
 ├── BillingInvoice[] (platform invoices — distinct from school fee Invoice)
 ├── ApiKey[] (REST API v1)
 ├── WebhookEndpoint[] / WebhookEventLog[] (outbound events)
 ├── SupportTicket[]
 └── AuditLog[] (platform trail)
```

Platform-scope tables (no tenant): `SubscriptionPlan`, `Coupon`,
`PlatformSettings` (singleton id=1), `BackupJob`, `EmailLog`.

`User.schoolId` is **nullable**: `SUPER_ADMIN` users belong to the platform,
every other user belongs to exactly one school.

## 2. Isolation layers (defense in depth)

| Layer | Mechanism |
|---|---|
| 1. Middleware (edge) | Session required for `/api` (except public prefixes); role gates per prefix; `x-tenant-id` request header injected from the JWT (routes can trust it — it cannot be spoofed through the edge); `/superadmin` SUPER_ADMIN-only |
| 2. Route guards | `apiGuard({ roles, feature, schoolScoped })` (or `requireRole(session, roles, { schoolScoped: true })` on legacy routes) — every Phase 9 route starts with it |
| 3. Tenant asserts | `assertTenantAccess(session, targetSchoolId)` — explicit 403 for cross-tenant reads |
| 4. Query scoping | Every `findMany/findUnique` on tenant data filters by `schoolId`; relation filters (`student: { schoolId }`) used where the row has no direct FK |
| 5. API keys | v1 routes resolve the key → schoolId and run the same scoped queries; keys are SHA-256 hashed, revocable, expirable |

The isolation test script (`scripts/verify-tenant-isolation.sh`) exercises
layers 2–5 end-to-end against a live instance.

## 3. Billing flow

```
/admin/subscription → POST /api/billing/subscription {planCode, cycle, couponCode}
  → billing provider adapter (Stripe | Paystack | Flutterwave) → checkout URL
  → school pays on provider site
  → provider webhook → /api/billing/webhooks/{provider} (signature verified)
  → billing service applies event:
       checkout.completed → Subscription ACTIVE + BillingInvoice OPEN
       invoice.paid       → invoice PAID + receipt email
       invoice.payment_failed → invoice FAILED + Subscription PAST_DUE + alert
       subscription.updated/canceled → status sync
```

- Prices are stored in **minor units** (cents/kobo) with an explicit currency.
- Coupons: platform-wide, percent or fixed, redemptions + validity windows.
- Trials: `PlatformSettings.defaultTrialDays` (14); the daily cron expires
  ended trials.
- Proration on plan changes is delegated to the provider
  (`proration_behavior` on Stripe; documented steps for Paystack/Flutterwave
  in `docs/BILLING.md`).

## 4. Feature licensing & usage limits

- Plan `features` Json: `{ maxStudents, maxTeachers, storageMb,
  aiTokensPerMonth, apiCallsPerMonth, modules: { FeatureModule: boolean } }`.
- `getEffectiveModules(schoolId)` = plan defaults overridden by
  `FeatureFlag` rows.
- Enforcement points: `apiGuard({ feature })` (new routes), student/teacher
  creation (`checkUsageLimit` → 403 with a clear message), uploads (storage
  quota), AI module (its own token/cost budget), v1 API (API_CALLS meter).
- Metering: `UsageRecord` upsert per `(schoolId, metric, period)`.

## 5. Super admin portal

`/superadmin` (SUPER_ADMIN only) — platform KPIs, tenant management
(suspend/activate, plan change, trial extension), plans CRUD, coupons,
support tickets, audit log, backups, platform settings (registration pause,
maintenance mode). All backed by `/api/superadmin/*` with
`apiGuard({ roles: ["SUPER_ADMIN"] })`.

## 6. API v1 + webhooks

- Auth: `x-api-key` → SHA-256 → `ApiKey` row → schoolId. Keys managed in
  Admin → API Keys; created once, never stored in plaintext.
- Conventions: pagination `?page=&pageSize=` (max 200), sorting
  `?sort=&order=` (whitelisted fields), simple equality filters, envelope
  `{ data, meta }`.
- OpenAPI: `/api/v1/openapi.json` (source doc: `docs/API.md`).
- Outbound webhooks: HMAC-SHA256 signed (`X-EduFlow-Signature`), idempotency
  key header, exponential-backoff retries (max 5) via the daily cron.

## 7. Observability & operations

- Structured JSON logs (`src/lib/saas/logger.ts`), `x-request-id` on every
  response.
- `AuditLog` for auth/billing/tenant/admin/onboarding/API events.
- Health: `/api/health` (liveness), `/api/health/ready` (DB ping).
- Cron: `/api/cron/daily` (trial expiry, past-due downgrade, overdue
  invoices, webhook retries) — protected by `CRON_SECRET`, scheduled in
  `vercel.json`.
- Backups: Neon PITR primary; `scripts/backup.ts` (pg_dump) + `restore.sh`
  for verifiable manual/scheduled dumps; `BackupJob` records.
- Alerts: `sendAlert` → `ALERT_WEBHOOK_URL` (Slack-compatible) for payment
  failures and backup failures.

## 8. Security

Middleware security headers + CSP; rate-limited registration and login
(login: 10/min/IP, register: 5/15min/IP); maintenance mode with an
edge-friendly probe; bcrypt(12) passwords (existing); provider webhook
signature verification (HMAC-SHA256 Stripe, HMAC-SHA512 Paystack,
verif-hash Flutterwave); secrets only in env (never in client bundles).
