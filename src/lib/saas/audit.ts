// ─── Phase 9: audit trail ────────────────────────────────────────────
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "./logger";

export async function audit(entry: {
  schoolId?: string | null;
  actorId?: string | null;
  action: string;
  category: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: unknown;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId: entry.schoolId ?? null,
        actorId: entry.actorId ?? null,
        action: entry.action,
        category: entry.category,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ip: entry.ip ?? null,
      },
    });
  } catch (e) {
    // Auditing must never break the flow it records.
    logger.error("audit write failed", { error: String(e) });
  }
}
