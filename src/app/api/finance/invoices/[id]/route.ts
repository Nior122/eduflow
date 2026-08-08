import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, invoiceUpdateSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { logFinanceAudit } from "@/lib/finance/audit";
import { invoiceDue } from "@/lib/finance/types";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, student: { schoolId } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } } } },
      items: true,
      payments: { include: { payment: { select: { id: true, method: true, reference: true, paidAt: true, receivedBy: { select: { name: true } } } } } },
      receipts: { select: { id: true, receiptNumber: true, amount: true, issuedAt: true, qrCode: true } },
      discount: { select: { id: true, name: true, type: true, value: true } },
      session: { select: { name: true } },
      term: { select: { name: true } },
      plan: true,
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  return NextResponse.json({
    invoice: {
      ...invoice,
      due: invoiceDue(invoice),
      amount: Number(invoice.amount),
      discountAmount: Number(invoice.discountAmount),
      paidAmount: Number(invoice.paidAmount),
      items: invoice.items.map((i) => ({ ...i, amount: Number(i.amount), discountAmount: Number(i.discountAmount) })),
    },
  });
}

/**
 * PATCH /api/finance/invoices/[id] — edit DRAFT invoices (notes only;
 * items are immutable once created to keep audit integrity).
 */
export async function PATCH(req: Request, { params }: RouteCtx) {
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
    return NextResponse.json({ error: "Only draft invoices can be edited (locked: " + existing.status + ")" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = validate(invoiceUpdateSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: { notes: parsed.data.notes ?? undefined },
  });
  await logFinanceAudit({
    actorId: g.session?.user?.id ?? null,
    action: "INVOICE_EDIT",
    entity: "Invoice",
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { notes: invoice.notes },
  });
  return NextResponse.json({ invoice });
}
