/**
 * EduFlow — database backup runner.
 *
 * Usage:  npx tsx scripts/backup.ts [--kind manual|scheduled]
 * Requires: pg_dump on PATH, DATABASE_URL (direct connection works best).
 * Writes:  backups/eduflow-<timestamp>.sql
 * Records: a BackupJob row (PENDING → RUNNING → COMPLETED/FAILED) and
 *          alerts on failure via ALERT_WEBHOOK_URL.
 *
 * Production note: Neon's native point-in-time recovery is the primary
 * backup mechanism on Vercel/Neon; this script covers self-hosted and
 * manual/verifiable dumps. See docs/OPERATIONS.md.
 */
import { execSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/db";
import {
  createBackupJob,
  markBackupRunning,
  markBackupCompleted,
  markBackupFailed,
} from "../src/lib/saas/backups";
import { sendAlert } from "../src/lib/saas/alerts";

async function main() {
  const kind = process.argv.includes("--kind=scheduled") ? "SCHEDULED" : "MANUAL";
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.error("backup: DATABASE_URL is required");
    process.exit(1);
  }

  const job = await createBackupJob(kind);
  await markBackupRunning(job.id);
  console.log(`backup: starting ${kind} job ${job.id}`);

  try {
    mkdirSync("backups", { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join("backups", `eduflow-${ts}.sql`);
    execSync(`pg_dump "${url}" -f "${file}" --no-owner --no-acl`, { stdio: "inherit" });
    const sizeBytes = statSync(file).size;
    await markBackupCompleted(job.id, file, sizeBytes);
    console.log(`backup: completed → ${file} (${(sizeBytes / 1024 / 1024).toFixed(1)} MB)`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await markBackupFailed(job.id, message);
    await sendAlert({
      title: "Database backup FAILED",
      message: `Job ${job.id}: ${message}`,
      level: "error",
    });
    console.error("backup: failed", message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
