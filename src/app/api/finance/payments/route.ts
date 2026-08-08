import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, paymentCreateSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { recordPayment, PaymentError } from "@/lib/finance/payments";
import { Prisma } from "@prisma/client";

/**
 * GET /api/finance/payments — list with filters.
 * ?studentId&method&status&search&from&to
 */
export async function GET(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const method = searchParams.get("method");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.PaymentWhereInput = { schoolId };
  if (method) where.method = method as Prisma.PaymentWhereInput["method"];
  if (status) where.status = status as Prisma.PaymentWhereInput["status"];
  if (from || to) {
    where.paidAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
    };
  }
  if (search) where.reference = { contains: search, mode: "insensitive" };
  if (studentId) where.invoicePayments = { some: { invoice: { studentId } } };

  const payments = await prisma.payment.findMany({
    where,
    include: {
      invoicePayments: { include: { invoice: { select: { invoiceNumber: true, student: { select: { firstName: true, lastName: true, admissionNumber: true } } } } } },
      receipt: { select: { id: true, receiptNumber: true } },
      receivedBy: { select: { name: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    payments: payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      invoicePayments: p.invoicePayments.map((ip) => ({
        invoiceId: ip.invoiceId,
        invoiceNumber: ip.invoice.invoiceNumber,
        amount: Number(ip.amount),
        studentName: `${ip.invoice.student.firstName} ${ip.invoice.student.lastName}`,
        admissionNumber: ip.invoice.student.admissionNumber,
      })),
    })),
  });
}

/**
 * POST /api/finance/payments — record a payment.
 * Body: { amount, method, reference, invoiceIds? | studentId?, notes? }
 * Allocates FIFO across open invoices, generates a receipt, updates
 * outstanding balances and writes the audit trail in one transaction.
 */
export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await req.json();
    const parsed = validate(paymentCreateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const result = await recordPayment({
      schoolId,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      invoiceIds: data.invoiceIds,
      studentId: data.studentId,
      notes: data.notes,
      receivedById: g.session?.user?.id ?? null,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to record payment:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
