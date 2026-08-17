/**
 * EduFlow — production migration runner (runs in the Vercel build).
 *
 * 1. Prefers DIRECT_URL; otherwise derives the Neon direct connection
 *    from DATABASE_URL by removing the "-pooler" marker (Prisma Migrate
 *    cannot run through the pooled endpoint).
 * 2. Runs `prisma migrate deploy`.
 * 3. AUTO-BASELINE (P3005): when the database was created with
 *    `prisma db push` (no _prisma_migrations history), migrate deploy
 *    refuses with "P3005 — schema is not empty". In that case the
 *    script baselines the current schema as `0_init` (`migrate diff`),
 *    records it and every pre-existing migration as applied
 *    (`migrate resolve`), reconciles the live database with a
 *    non-destructive `prisma db push --skip-generate`, and deploys
 *    again. From then on the database has a real migration history.
 *
 * Fail-safe: `prisma db push` refuses destructive changes without
 * `--accept-data-loss`; if one is required the build fails loudly
 * instead of mutating production data.
 *
 * NOTE: this is a plain Node ESM script (.mjs) — no TypeScript syntax.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (process.env.SKIP_MIGRATE === "1") {
  console.log("migrate-deploy: SKIP_MIGRATE=1 — skipping migrations (CI/build without DB).");
  process.exit(0);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

// ── direct connection ──────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL ?? "";
const directUrl =
  process.env.DIRECT_URL ||
  (databaseUrl.includes("-pooler.")
    ? databaseUrl.replace("-pooler.", ".")
    : databaseUrl);
if (!directUrl) {
  console.error("migrate-deploy: DATABASE_URL is not set (and no DIRECT_URL).");
  process.exit(1);
}
if (!process.env.DIRECT_URL) {
  console.log("migrate-deploy: derived DIRECT_URL from DATABASE_URL (removed -pooler)");
}
process.env.DIRECT_URL = directUrl;

// ── baseline a db-pushed database (no migration history) ───────────
function baselineExistingDatabase() {
  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  const baselineDir = join(migrationsDir, "0_init");
  mkdirSync(baselineDir, { recursive: true });

  console.log("migrate-deploy: database has no migration history (P3005) — baselining.");
  console.log(
    "migrate-deploy: generating 0_init from the current schema, recording existing " +
      "migrations as applied, then reconciling with db push."
  );

  const baselineSql = execSync(
    "prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { encoding: "utf8" }
  );
  writeFileSync(join(baselineDir, "migration.sql"), baselineSql);
  console.log(`migrate-deploy: wrote 0_init baseline (${baselineSql.split("\n").length} lines).`);

  run('prisma migrate resolve --applied "0_init"');

  const existing = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "0_init")
    .map((d) => d.name)
    .sort();
  for (const name of existing) {
    console.log(`migrate-deploy: recording existing migration as applied: ${name}`);
    run(`prisma migrate resolve --applied "${name}"`);
  }

  console.log(
    "migrate-deploy: reconciling schema drift with `prisma db push --skip-generate` (non-destructive)."
  );
  run("prisma db push --skip-generate");

  run("prisma migrate deploy");
}

// execSync failures carry the child output in error.stderr / error.stdout
// (not in the message), so assemble the full text for the P3005 check.
function errorText(error) {
  const stderr =
    error && typeof error.stderr === "string"
      ? error.stderr
      : error && Buffer.isBuffer(error.stderr)
        ? error.stderr.toString()
        : "";
  const stdout =
    error && typeof error.stdout === "string"
      ? error.stdout
      : error && Buffer.isBuffer(error.stdout)
        ? error.stdout.toString()
        : "";
  return `${error && error.message ? error.message : ""} ${stderr} ${stdout}`;
}

try {
  run("prisma migrate deploy");
} catch (error) {
  if (/P3005|schema is not empty/i.test(errorText(error))) {
    baselineExistingDatabase();
  } else {
    throw error;
  }
}
