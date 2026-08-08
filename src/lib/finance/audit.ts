// ─── Phase 5: finance audit trail ────────────────────────────────────
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface FinanceAuditEntry {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}

/** Append a finance audit log row. Never throws (auditing must not break payments). */
export async function logFinanceAudit(opts: FinanceAuditEntry): Promise<void> {
  try {
    await prisma.financeAuditLog.create({
      data: {
        actorId: opts.actorId ?? undefined,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId ?? undefined,
        oldValue: opts.oldValue === undefined ? undefined : (opts.oldValue as Prisma.InputJsonValue),
        newValue: opts.newValue === undefined ? undefined : (opts.newValue as Prisma.InputJsonValue),
        ip: opts.ip ?? undefined,
      },
    });
  } catch (error) {
    console.error("Finance audit log write failed:", error);
  }
}
