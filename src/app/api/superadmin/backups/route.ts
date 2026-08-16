import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiGuard } from "@/lib/saas/guard";
import { createBackupJob } from "@/lib/saas/backups";
import { audit } from "@/lib/saas/audit";

/**
 * GET /api/superadmin/backups — backup job history.
 * POST /api/superadmin/backups — request a manual backup (recorded here;
 * the actual pg_dump runs in scripts/backup.ts, see docs/OPERATIONS.md).
 */
export async function GET() {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const jobs = await prisma.backupJob.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ jobs });
}

export async function POST() {
  const guard = await apiGuard({ roles: ["SUPER_ADMIN"] });
  if (guard instanceof NextResponse) return guard;
  const job = await createBackupJob("MANUAL", guard.userId);
  await audit({
    actorId: guard.userId,
    action: "BACKUP_REQUESTED",
    category: "ADMIN",
    metadata: { jobId: job.id },
  });
  return NextResponse.json({ job }, { status: 201 });
}
