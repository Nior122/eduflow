# EduFlow — Admin Guide (Phase 9)

Two admin surfaces exist:

- **School admin** (`/admin/*`) — runs the school.
- **Platform owner** (`/superadmin`, role `SUPER_ADMIN`) — runs the SaaS.

## School admin

### Subscription (`/admin/subscription`)
- See current plan, status (TRIALING / ACTIVE / PAST_DUE / CANCELED /
  EXPIRED), trial end date, and usage meters against plan limits.
- Switch billing cycle (monthly/yearly), pick a plan → checkout on the
  configured provider (Stripe/Paystack/Flutterwave).
- Enter a coupon code during checkout to get the discount.
- Cancel at period end (keeps access until the period ends) or reactivate.
- Invoices are listed under the same page.

### Feature modules (`/admin/features`)
- Shows each module (Library, Transport, Payroll, AI, Hostel, Clinic,
  Inventory, Certificates, Messaging, Reports, Billing) with its plan
  default and the effective state.
- Toggle per-school overrides. Modules not included in your plan cannot be
  force-enabled by the school — the platform owner controls plan contents.

### API Keys (`/admin/api-keys`)
- Generate keys for the REST API (`/api/v1`). The plaintext key is shown
  exactly once — copy it immediately.
- Revoke or re-enable keys at any time.

### Webhooks (`/admin/webhooks`)
- Register an HTTPS endpoint and pick events (student.created,
  teacher.created, payment.received, result.published, attendance.recorded).
- Deliveries are signed with `X-EduFlow-Signature` (HMAC-SHA256 of the raw
  body with your secret) and carry an idempotency key
  (`X-EduFlow-Idempotency-Key`). Failed deliveries retry with backoff.

### Support (`/admin/support`)
- Open tickets with priority; the platform team replies by email.

## Platform owner (`/superadmin`)

| Page | What you can do |
|---|---|
| Overview | Schools, MRR, active subs, users, AI cost, storage, tickets, DB health, recent registrations |
| Schools | Search all tenants; open a school to see users/usage/invoices/tickets; suspend or activate a school; change its plan; extend a trial |
| Plans | Create/update plans (upsert by code), set prices (minor units) and limits (students, teachers, storage MB, AI tokens, API calls), activate/deactivate |
| Coupons | Percent or fixed discounts, max redemptions, validity window; schools enter the code at checkout |
| Support tickets | Triage: status (OPEN → PENDING → RESOLVED → CLOSED), priority, assignee |
| Audit log | Filterable trail of auth/billing/tenant/admin/onboarding/API events |
| Backups | Request manual backups; the `pg_dump` runner is `scripts/backup.ts` (see OPERATIONS.md) |
| Platform settings | Pause registration, change trial length / default plan / currency / support email, toggle maintenance mode with a message |

### Suspending a school
Suspending sets `School.status = SUSPENDED` (the school's UI/API keep
working until suspension checks are wired into their routes — gate critical
actions behind `apiGuard`). Plan to enforce it in the shared layout next.

### Maintenance mode
Two switches: env `MAINTENANCE_MODE=1` (edge fast path) and the platform
setting (served by `/api/internal/maintenance`). While on: API → 503 JSON,
pages → `/maintenance`, health endpoints stay up.
