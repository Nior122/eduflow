// ─── Phase 5: financial document numbering ───────────────────────────
// Race-safe sequential numbering via a per-school/per-kind/year counter.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type SequenceKind = "INVOICE" | "RECEIPT";

type TxClient = Prisma.TransactionClient | typeof prisma;

export async function nextNumber(
  opts: { schoolId: string; kind: SequenceKind; year?: number },
  tx: TxClient = prisma
): Promise<string> {
  const year = opts.year ?? new Date().getFullYear();
  const seq = await tx.numberSequence.upsert({
    where: {
      schoolId_kind_year: { schoolId: opts.schoolId, kind: opts.kind, year },
    },
    create: { schoolId: opts.schoolId, kind: opts.kind, year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  const prefix = opts.kind === "INVOICE" ? "INV" : "RCP";
  return `${prefix}-${year}-${String(seq.lastValue).padStart(4, "0")}`;
}
