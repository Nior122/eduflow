// ─── Phase 9: backup job records ─────────────────────────────────────
// The actual `pg_dump` runs in scripts/backup.ts; this module keeps the
// BackupJob lifecycle consistent from anywhere in the app.
import { prisma } from "@/lib/db";

export async function createBackupJob(kind: "MANUAL" | "SCHEDULED", createdById?: string | null) {
  return prisma.backupJob.create({
    data: { kind, status: "PENDING", createdById: createdById ?? null },
  });
}

export async function markBackupRunning(id: string) {
  return prisma.backupJob.update({ where: { id }, data: { status: "RUNNING", startedAt: new Date() } });
}

export async function markBackupCompleted(id: string, url: string | null, sizeBytes: number | null) {
  return prisma.backupJob.update({
    where: { id },
    data: { status: "COMPLETED", url, sizeBytes, completedAt: new Date() },
  });
}

export async function markBackupFailed(id: string, error: string) {
  return prisma.backupJob.update({
    where: { id },
    data: { status: "FAILED", error, completedAt: new Date() },
  });
}
