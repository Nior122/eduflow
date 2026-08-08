import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { financeGuard } from "@/lib/finance/guards";
import { logFinanceAudit } from "@/lib/finance/audit";

/**
 * POST /api/finance/invoices/[id]/cancel — cancel an invoice.
 * Paid invoices cannot be cancelled (financial integrity).
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
  if (existing.status === "PAID") {
    return NextResponse.json({ error: "Cannot cancel a paid invoice" }, { status: 409 });
  }
  if (existing.status === "CANCELLED") {
    return NextResponse.json({ error: "Invoice is already cancelled" }, { status: 409 });
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: g.session?.user?.id ?? null },
  });
  await logFinanceAudit({
    actorId: g.session?.user?.id ?? null,
    action: "INVOICE_CANCEL",
    entity: "Invoice",
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: "CANCELLED" },
  });
  return NextResponse.json({ invoice });
}
