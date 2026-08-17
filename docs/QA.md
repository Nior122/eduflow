

### First deploy against an existing database (P3005 baseline)

If `npm run build` fails with **P3005 — the database schema is not
empty**, the database was created with `db push` and has no migration
history. The build script now auto-baselines it (see
`docs/DEPLOYMENT.md` → "Baseline an existing database") — redeploy and
the baseline + schema reconciliation run automatically. Verify afterwards
that `prisma/migrations/0_init` exists in the build output and
`_prisma_migrations` is populated in the database.

