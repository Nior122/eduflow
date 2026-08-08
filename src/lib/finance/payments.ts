// ─── Phase 5: payment recording, outstanding & payment plans ─────────
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logFinanceAudit } from "./audit";
import { nextNumber } from "./numbers";
import { money, INVOICE_STATUS_LABEL } from "./types";
import type { InvoiceStatus } from "@prisma/client";

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export interface RecordPaymentInput {
  schoolId: string;
  amount: number;
  method: "CASH" | "BANK_TRANSFER" | "CARD" | "MOBILE_MONEY" | "CHEQUE";
  reference: string;
  invoiceIds?: string[];
  studentId?: string;
  notes?: string;
  receivedById?: string | null;
  ip?: string | null;
}

export interface RecordPaymentResult {
  payment: { id: string; reference: string; amount: number; method: string };
  receipt: { id: string; receiptNumber: string; amount: number };
  allocations: { invoiceId: string; invoiceNumber: string; amount: number; statusBefore: string; statusAfter: string }[];
}

/**
 * Record a payment against one or more open invoices (FIFO allocation),
 * auto-generate a receipt, update invoice statuses and audit everything
 * in a single transaction. Duplicate references are rejected.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  const amount = money(input.amount);
  if (amount <= 0) throw new PaymentError("Amount must be greater than zero");

  const invoiceWhere: Prisma.InvoiceWhereInput = { student: { schoolId: input.schoolId } };
  if (input.invoiceIds?.length) invoiceWhere.id = { in: input.invoiceIds };
  else if (input.studentId) invoiceWhere.studentId = input.studentId;
  else throw new PaymentError("Provide invoiceIds or studentId");
  invoiceWhere.status = { in: ["ISSUED", "PARTIAL", "OVERDUE"] };

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      latePayments: { select: { id: true } },
    },
    orderBy: { dueDate: "asc" },
  });
  if (invoices.length === 0) throw new PaymentError("No outstanding invoices found");

  const open = invoices
    .map((inv) => ({ inv, remaining: money(Number(inv.amount) - Number(inv.discountAmount) - Number(inv.paidAmount)) }))
    .filter((x) => x.remaining > 0);
  const totalOutstanding = money(open.reduce((sum, x) => sum + x.remaining, 0));
  if (amount > totalOutstanding) {
    throw new PaymentError(`Amount exceeds the outstanding balance (${totalOutstanding.toFixed(2)})`);
  }

  const primary = open[0];
  const allocations: { inv: (typeof primary)["inv"]; take: number; newStatus: InvoiceStatus }[] = [];
  let rest = amount;
  for (const x of open) {
    if (rest <= 0) break;
    const take = money(Math.min(x.remaining, rest));
    rest = money(rest - take);
    const due = money(Number(x.inv.amount) - Number(x.inv.discountAmount));
    const newPaid = money(Number(x.inv.paidAmount) + take);
    const newStatus: InvoiceStatus = newPaid >= due ? "PAID" : "PARTIAL";
    allocations.push({ inv: x.inv, take, newStatus });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          amount,
          method: input.method,
          reference: input.reference,
          status: "PAID",
          paidAt: new Date(),
          notes: input.notes ?? null,
          schoolId: input.schoolId,
          receivedById: input.receivedById ?? null,
        },
      });
      const receipt = await tx.receipt.create({
        data: {
          receiptNumber: await nextNumber({ schoolId: input.schoolId, kind: "RECEIPT" }, tx),
          amount,
          method: input.method,
          studentId: primary.inv.studentId,
          invoiceId: primary.inv.id,
          paymentId: payment.id,
          receivedById: input.receivedById ?? null,
        },
      });
      for (const a of allocations) {
        await tx.invoicePayment.create({
          data: { invoiceId: a.inv.id, paymentId: payment.id, amount: a.take },
        });
        await tx.invoice.update({
          where: { id: a.inv.id },
          data: { paidAmount: { increment: a.take }, status: a.newStatus },
        });
        if (a.inv.latePayments.length > 0) {
          await tx.latePayment.updateMany({
            where: { invoiceId: a.inv.id, status: { in: ["PENDING", "SENT"] } },
            data: { status: "RESOLVED" },
          });
        }
      }
      return { payment, receipt, allocations };
    });

    await logFinanceAudit({
      actorId: input.receivedById,
      action: "PAYMENT_RECORD",
      entity: "Payment",
      entityId: result.payment.id,
      newValue: {
        reference: input.reference,
        amount,
        method: input.method,
        allocations: result.allocations.map((a) => ({
          invoiceId: a.inv.id,
          invoiceNumber: a.inv.invoiceNumber,
          take: a.take,
          statusAfter: a.newStatus,
        })),
      },
      ip: input.ip,
    });
    await logFinanceAudit({
      actorId: input.receivedById,
      action: "RECEIPT_GENERATE",
      entity: "Receipt",
      entityId: result.receipt.id,
      newValue: { receiptNumber: result.receipt.receiptNumber, amount },
      ip: input.ip,
    });

    return {
      payment: { id: result.payment.id, reference: result.payment.reference, amount: Number(result.payment.amount), method: result.payment.method },
      receipt: { id: result.receipt.id, receiptNumber: result.receipt.receiptNumber, amount: Number(result.receipt.amount) },
      allocations: result.allocations.map((a) => ({
        invoiceId: a.inv.id,
        invoiceNumber: a.inv.invoiceNumber,
        amount: a.take,
        statusBefore: INVOICE_STATUS_LABEL[a.inv.status],
        statusAfter: INVOICE_STATUS_LABEL[a.newStatus],
      })),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PaymentError("A payment with this reference already exists (duplicate rejected)");
    }
    throw error;
  }
}

/**
 * Mark past-due invoices OVERDUE and create a LatePayment record the
 * first time each becomes overdue (reminder queue). Idempotent.
 */
export async function recomputeOverdueInvoices(opts: { schoolId: string }): Promise<number> {
  const overdue = await prisma.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIAL"] },
      dueDate: { lt: new Date() },
      student: { schoolId: opts.schoolId },
    },
    select: {
      id: true,
      studentId: true,
      dueDate: true,
      amount: true,
      discountAmount: true,
      paidAmount: true,
      latePayments: { select: { id: true } },
      items: { include: { fee: { select: { lateFee: true } } } },
    },
  });

  let created = 0;
  for (const inv of overdue) {
    if (inv.latePayments.length > 0) continue;
    const daysLate = Math.max(1, Math.floor((Date.now() - (inv.dueDate?.getTime() ?? Date.now())) / 86_400_000));
    const penalty = Math.max(0, ...inv.items.map((i) => Number(i.fee?.lateFee ?? 0)));
    await prisma.$transaction([
      prisma.invoice.update({ where: { id: inv.id }, data: { status: "OVERDUE" } }),
      prisma.latePayment.create({
        data: {
          invoiceId: inv.id,
          studentId: inv.studentId,
          daysLate,
          penaltyAmount: penalty > 0 ? penalty : null,
          status: "PENDING",
        },
      }),
    ]);
    created += 1;
  }
  return created;
}

export interface OutstandingRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  totalBilled: number;
  totalPaid: number;
  balance: number;
  daysLate: number;
  hasPlan: boolean;
  invoices: { id: string; invoiceNumber: string; amount: number; discountAmount: number; paidAmount: number; status: string; dueDate: Date | null }[];
}

/** Outstanding balances per student (open invoices only). */
export async function getOutstanding(opts: {
  schoolId: string;
  classId?: string;
  sessionId?: string;
  termId?: string;
  onlyDefaulters?: boolean;
}): Promise<OutstandingRow[]> {
  await recomputeOverdueInvoices({ schoolId: opts.schoolId });

  const where: Prisma.InvoiceWhereInput = {
    status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] },
    student: {
      schoolId: opts.schoolId,
      ...(opts.classId ? { classId: opts.classId } : {}),
    },
  };
  if (opts.sessionId) where.sessionId = opts.sessionId;
  if (opts.termId) where.termId = opts.termId;

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          class: { select: { name: true } },
        },
      },
      latePayments: { select: { id: true, daysLate: true, status: true } },
      plan: { select: { id: true, status: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const byStudent = new Map<string, OutstandingRow>();
  for (const inv of invoices) {
    const key = inv.studentId;
    const row = byStudent.get(key) ?? {
      studentId: key,
      studentName: `${inv.student.firstName} ${inv.student.lastName}`,
      admissionNumber: inv.student.admissionNumber,
      className: inv.student.class?.name ?? null,
      totalBilled: 0,
      totalPaid: 0,
      balance: 0,
      daysLate: 0,
      hasPlan: false,
      invoices: [],
    };
    const due = money(Number(inv.amount) - Number(inv.discountAmount));
    const paid = money(Number(inv.paidAmount));
    row.totalBilled = money(row.totalBilled + due);
    row.totalPaid = money(row.totalPaid + paid);
    row.balance = money(row.balance + due - paid);
    row.daysLate = Math.max(row.daysLate, ...inv.latePayments.map((l) => l.daysLate));
    if (inv.plan?.status === "ACTIVE") row.hasPlan = true;
    row.invoices.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: due,
      discountAmount: Number(inv.discountAmount),
      paidAmount: paid,
      status: inv.status,
      dueDate: inv.dueDate,
    });
    byStudent.set(key, row);
  }

  let rows = [...byStudent.values()].sort((a, b) => b.balance - a.balance);
  if (opts.onlyDefaulters) rows = rows.filter((r) => r.balance > 0 && r.daysLate > 0);
  return rows;
}

export async function sendReminders(opts: {
  schoolId: string;
  invoiceIds: string[];
  actorId?: string | null;
  ip?: string | null;
}): Promise<number> {
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: opts.invoiceIds }, student: { schoolId: opts.schoolId } },
    select: { id: true },
  });
  if (invoices.length === 0) return 0;
  const updated = await prisma.latePayment.updateMany({
    where: { invoiceId: { in: invoices.map((i) => i.id) }, status: "PENDING" },
    data: { status: "SENT", remindedAt: new Date() },
  });
  await logFinanceAudit({
    actorId: opts.actorId,
    action: "REMINDER_SENT",
    entity: "LatePayment",
    entityId: invoices[0].id,
    newValue: { invoiceIds: opts.invoiceIds, count: updated.count },
    ip: opts.ip,
  });
  return updated.count;
}

export interface CreatePlanInput {
  schoolId: string;
  studentId: string;
  invoiceId?: string;
  totalAmount: number;
  installmentAmount: number;
  installmentCount: number;
  frequency: "WEEKLY" | "MONTHLY" | "TERMLY";
  startDate?: string | null;
  dueDate?: string | null;
  createdById?: string | null;
  ip?: string | null;
}

export async function createPaymentPlan(input: CreatePlanInput) {
  const student = await prisma.student.findFirst({
    where: { id: input.studentId, schoolId: input.schoolId, isActive: true },
    select: { id: true },
  });
  if (!student) throw new PaymentError("Student not found");

  if (input.invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, studentId: input.studentId, status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } },
      select: { id: true },
    });
    if (!invoice) throw new PaymentError("Invoice not found or not open for this student");
  }

  if (money(input.installmentAmount) * input.installmentCount < money(input.totalAmount)) {
    throw new PaymentError("Installments do not cover the total amount");
  }

  const plan = await prisma.paymentPlan.create({
    data: {
      studentId: input.studentId,
      invoiceId: input.invoiceId ?? null,
      totalAmount: money(input.totalAmount),
      installmentAmount: money(input.installmentAmount),
      installmentCount: input.installmentCount,
      frequency: input.frequency,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      createdById: input.createdById ?? null,
    },
  });
  await logFinanceAudit({
    actorId: input.createdById,
    action: "PLAN_CREATE",
    entity: "PaymentPlan",
    entityId: plan.id,
    newValue: { studentId: input.studentId, totalAmount: Number(plan.totalAmount), installments: plan.installmentCount },
    ip: input.ip,
  });
  return plan;
}

export async function updatePlanStatus(opts: {
  planId: string;
  schoolId: string;
  status: "COMPLETED" | "CANCELLED";
  actorId?: string | null;
}) {
  const plan = await prisma.paymentPlan.findFirst({
    where: { id: opts.planId, student: { schoolId: opts.schoolId } },
  });
  if (!plan) throw new PaymentError("Payment plan not found");
  if (plan.status !== "ACTIVE") throw new PaymentError("Only active plans can be updated");
  const updated = await prisma.paymentPlan.update({
    where: { id: plan.id },
    data: { status: opts.status, endDate: opts.status === "COMPLETED" ? new Date() : undefined },
  });
  await logFinanceAudit({
    actorId: opts.actorId,
    action: "PLAN_UPDATE",
    entity: "PaymentPlan",
    entityId: plan.id,
    oldValue: { status: plan.status },
    newValue: { status: updated.status },
  });
  return updated;
}
