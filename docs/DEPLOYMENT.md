# EduFlow — Production Deployment Guide (Phase 9)

## Recommended stack

| Layer | Provider | Notes |
|---|---|---|
| Frontend / API | **Vercel** | Next.js 15; cron via `vercel.json` |
| Database | **Neon PostgreSQL** | pooled URL for the app (`DATABASE_URL`), direct URL for migrations (`DIRECT_URL` — auto-derived from the non-pooler host) |
| Object storage | **Cloudinary** (or Vercel Blob) | `STORAGE_PROVIDER=cloudinary` + `CLOUDINARY_*` keys |
| Email | **Resend** | `RESEND_API_KEY` + `RESEND_FROM` |
| Billing | Stripe and/or Paystack and/or Flutterwave | see `docs/BILLING.md` |
| Alerts | Any Slack-compatible webhook | `ALERT_WEBHOOK_URL` |

## 1. Environment

```bash
cp .env.example .env.local   # then fill in:
```

Required: `DATABASE_URL`, `DIRECT_URL` (Neon direct connection),
`AUTH_SECRET` (`openssl rand -base64 32`), `CRON_SECRET` (same command).

Provider keys (set only what you use): `BILLING_PROVIDER`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`,
`FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`, `STORAGE_PROVIDER`,
`CLOUDINARY_*`, `RESEND_API_KEY`, `RESEND_FROM`, `ALERT_WEBHOOK_URL`,
`OPENAI_API_KEY` / other AI provider keys (Phases 7–8).

## 2. Database

```bash
npm install                 # postinstall runs prisma generate
npx prisma migrate dev --name phase9   # local dev (creates migration history)
# production:
npm run db:deploy           # runs `prisma migrate deploy` via scripts/migrate-deploy.mjs
                            # (uses DIRECT_URL; skips when SKIP_MIGRATE=1)
```

Fresh demo environment:

```bash
npm run db:push
SEED_CONFIRM=yes npm run db:seed
```

## 3. Vercel

1. Import the repo; framework preset Next.js (auto).
2. Add all env vars above (production).
3. Deploy. `vercel.json` already configures the daily cron
   (`/api/cron/daily` at 03:00 UTC) and security headers.
4. Uptime monitoring: point your provider at `https://<app>/api/health/ready`
   (200 = ready, 503 = DB unreachable).

## 4. Provider webhook URLs

- Stripe → `https://<app>/api/billing/webhooks/stripe`
- Paystack → `https://<app>/api/billing/webhooks/paystack`
- Flutterwave → `https://<app>/api/billing/webhooks/flutterwave`

See `docs/BILLING.md` for exact dashboard steps and secrets.

## 5. CI/CD

`.github/workflows/ci.yml` runs on push/PR: `npm ci` → `prisma generate` →
typecheck → lint → `vitest run` → production build (`SKIP_MIGRATE=1`, since
CI has no database).

Production deployment: Vercel auto-deploys `main`; migrations run in the
build (`scripts/migrate-deploy.mjs`). For strict ordering, migrate manually
first (`npm run db:deploy`) or use the Vercel "build command" override.

## 6. Post-deploy checklist

```bash
# from your machine / a CI job
curl -s https://<app>/api/health/ready            # {"status":"ready",...}
curl -s https://<app>/api/v1/openapi.json | head  # spec served
./scripts/verify-tenant-isolation.sh              # BASE_URL=https://<app>
```

Verify: registration works (trial created), login as
`superadmin@eduflow.app` (seeded) opens `/superadmin`, a school admin sees
`/admin/subscription`, a test checkout returns a provider URL, and the
provider's test webhook flips the subscription to ACTIVE.
