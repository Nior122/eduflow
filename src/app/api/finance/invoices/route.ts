import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, invoiceCreateSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { logFinanceAudit } from "@/lib/finance/audit";
import { nextNumber } from "@/lib/finance/numbers";
import { money, invoiceDue } from "@/lib/finance/types";
import { applyDiscountValue, validateDiscountForInvoice } from "@/lib/finance/billing";
import { Prisma } from "@prisma/client";

/**
 * GET /api/finance/invoices — list with filters.
 * ?studentId&classId&sessionId&termId&status&search&from&to
 */
export async function GET(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const classId = searchParams.get("classId");
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: Prisma.InvoiceWhereInput = { student: { schoolId } };
  if (studentId) where.studentId = studentId;
  if (sessionId) where.sessionId = sessionId;
  if (termId) where.termId = termId;
  if (status) where.status = status as Prisma.InvoiceWhereInput["status"];
  if (classId) where.student = { schoolId, classId };
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { student: { firstName: { contains: search, mode: "insensitive" } } },
      { student: { lastName: { contains: search, mode: "insensitive" } } },
      { student: { admissionNumber: { contains: search, mode: "insensitive" } } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } } } },
      items: true,
      payments: { include: { payment: { select: { method: true, reference: true, paidAt: true } } } },
      discount: { select: { id: true, name: true, type: true, value: true } },
      receipts: { select: { id: true, receiptNumber: true, issuedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    invoices: invoices.map((inv) => ({
      ...inv,
      due: invoiceDue(inv),
      amount: Number(inv.amount),
      discountAmount: Number(inv.discountAmount),
      paidAmount: Number(inv.paidAmount),
    })),
  });
}

/**
 * POST /api/finance/invoices — create a manual invoice (DRAFT) for one
 * student from selected fees.
 */
export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(invoiceCreateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const student = await prisma.student.findFirst({
      where: { id: data.studentId, schoolId, isActive: true },
      select: { id: true, classId: true, firstName: true, lastName: true, admissionNumber: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const fees = await prisma.fee.findMany({
      where: { id: { in: data.feeIds }, schoolId, isActive: true },
      select: { id: true, name: true, amount: true, dueDate: true },
    });
    if (fees.length !== data.feeIds.length) {
      return NextResponse.json({ error: "One or more fees not found" }, { status: 404 });
    }

    let discount = null;
    if (data.discountId) {
      discount = await prisma.discount.findFirst({ where: { id: data.discountId, schoolId } });
      const issue = validateDiscountForInvoice(discount, {
        studentIds: [student.id],
        classIds: student.classId ? [student.classId] : [],
      });
      if (issue) return NextResponse.json({ error: issue }, { status: 400 });
      if (discount?.status === "APPROVED") {
        await prisma.discount.update({ where: { id: discount.id }, data: { status: "ACTIVE", appliedAt: new Date() } });
        discount = await prisma.discount.findFirst({ where: { id: discount.id, schoolId } });
      }
    }

    const amount = money(fees.reduce((sum, f) => sum + Number(f.amount), 0));
    const discountAmount = discount ? applyDiscountValue(discount, amount) : 0;
    const invoiceNumber = await nextNumber({ schoolId, kind: "INVOICE" });
    const dueDate = data.dueDate ? new Date(data.dueDate) : fees.reduce<Date | null>((latest, f) => (f.dueDate && (!latest || f.dueDate > latest) ? f.dueDate : latest), null);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        studentId: student.id,
        sessionId: data.sessionId ?? null,
        termId: data.termId ?? null,
        status: "DRAFT",
        amount,
        discountAmount,
        paidAmount: 0,
        dueDate,
        notes: data.notes ?? null,
        discountId: discount?.id ?? null,
        items: { create: fees.map((f) => ({ description: f.name, amount: f.amount, feeId: f.id })) },
      },
      include: { student: true, items: true },
    });

    await logFinanceAudit({
      actorId: g.session?.user?.id ?? null,
      action: "INVOICE_CREATE",
      entity: "Invoice",
      entityId: invoice.id,
      newValue: { invoiceNumber, studentId: student.id, amount, discountAmount, status: "DRAFT" },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Invoice number collision — retry" }, { status: 409 });
    }
    console.error("Failed to create invoice:", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
