import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { financeGuard } from "@/lib/finance/guards";
import { logFinanceAudit } from "@/lib/finance/audit";

/**
 * POST /api/finance/invoices/[id]/issue — publish a draft invoice
 * (DRAFT → ISSUED). After issue, items become immutable.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const existing = await prisma.invoice.findFirst({
    where: { id, student: { schoolId } },
    select: { id: true, status: true, invoiceNumber: true },
  });
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Only draft invoices can be issued (current: " + existing.status + ")" }, { status: 409 });
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: { status: "ISSUED", issuedAt: new Date(), issuedById: g.session?.user?.id ?? null },
  });
  await logFinanceAudit({
    actorId: g.session?.user?.id ?? null,
    action: "INVOICE_ISSUE",
    entity: "Invoice",
    entityId: id,
    oldValue: { status: "DRAFT" },
    newValue: { status: "ISSUED" },
  });
  return NextResponse.json({ invoice });
}
