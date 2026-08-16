# EduFlow — Operations Guide (Phase 9)

## Monitoring

- **Health probes**:
  - `/api/health` — liveness (200 always).
  - `/api/health/ready` — readiness; pings the DB (`SELECT 1`), returns
    `503` when the database is unreachable.
- Alert your uptime provider (Better Uptime / UptimeRobot / Grafana Cloud)
  on the ready probe.
- **Logs**: structured JSON on stdout (Vercel logs). Every request carries
  `x-request-id` — grep by it to trace a request across log lines.

## Error tracking

The app logs structured errors; wire Sentry by adding
`@sentry/nextjs` and initializing it in `next.config.js`/`instrumentation.ts`
(standard Next.js Sentry flow, not included to keep deps minimal).

## Audit trail

`/superadmin/audit` shows `AuditLog` rows (auth, billing, tenant, security,
admin, onboarding, API). Actions you should never see unexplained:
`CHECKOUT_STARTED`, `SUBSCRIPTION_STATUS`, `SCHOOL_SUSPENDED`,
`FEATURE_FLAG_CHANGED`, `API_KEY_CREATED`.

## Backup & recovery

**Primary (recommended): Neon Point-in-Time Recovery** — enabled by
default on Neon; keeps the database recoverable to any point in the
retention window. No action needed per backup.

**Verifiable dumps (self-hosted / manual):**

```bash
npx tsx scripts/backup.ts            # manual
CRON="0 3 * * *" # schedule on your infra, or:
npx tsx scripts/backup.ts --kind=scheduled
```

- Requires `pg_dump` on PATH and `DATABASE_URL` (direct connection).
- Writes `backups/eduflow-<timestamp>.sql`, records a `BackupJob` row
  (visible in `/superadmin/backups`), alerts on failure via
  `ALERT_WEBHOOK_URL`.
- Restore: `DATABASE_URL=... ./scripts/restore.sh backups/eduflow-<ts>.sql`
  (or `.sql.gz`).
- **Test restores quarterly** into a throwaway database — a backup that
  was never restored is not a backup.

## Alerting

`ALERT_WEBHOOK_URL` (Slack-compatible) receives:
- subscription payment failures,
- daily-cron mass expirations,
- backup failures.

Add more senders in `src/lib/saas/alerts.ts` (email via `sendSaaSEmail`
is a natural extension).

## Cron jobs

`vercel.json` schedules `/api/cron/daily` at 03:00 UTC:

1. expire trials (`TRIALING` + `trialEndsAt` past → `EXPIRED`),
2. downgrade subscriptions past-due > 30 days (`PAST_DUE` → `EXPIRED`),
3. mark invoices overdue (OPEN + 7 days past due),
4. retry due webhook deliveries.

All cron routes require `Authorization: Bearer $CRON_SECRET`. Invoke
manually: `curl -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/daily`.

## Maintenance mode

Toggle in `/superadmin/settings` (DB-backed, checked by the edge middleware
via `/api/internal/maintenance`) or set `MAINTENANCE_MODE=1` for an instant
edge-level switch. During maintenance: APIs → 503 JSON, pages →
`/maintenance`, health endpoints remain reachable.

## Rate limiting

In-memory sliding window per instance: registration (5/15min/IP), login
(10/min/IP), v1 API (120/min/IP). **Before horizontal scaling**, replace
`src/lib/rate-limit.ts` with a shared store (Upstash Redis is a drop-in
with the same `rateLimit(key, {limit, windowMs})` API).

## Secrets hygiene

- All secrets via environment variables; `.env.example` documents every
  key. Never commit `.env.local` (the repo's `.gitignore` covers it).
- Rotate `AUTH_SECRET` and `CRON_SECRET` on any suspected leak; rotating
  `AUTH_SECRET` signs everyone out (expected).
