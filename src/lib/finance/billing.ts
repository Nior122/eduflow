// ─── Phase 5: billing engine (fee → invoice generation) ──────────────
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logFinanceAudit } from "./audit";
import { nextNumber } from "./numbers";
import { money } from "./types";
import type { Discount } from "@prisma/client";

export interface GenerateBillingInput {
  schoolId: string;
  sessionId: string;
  termId: string;
  /** One of: studentIds | classId | (whole school when neither) */
  studentIds?: string[];
  classId?: string;
  /** When set, only fees of this department are billed; otherwise general fees (departmentId null). */
  departmentId?: string;
  feeIds?: string[];
  discountId?: string | null;
  dueDate?: string | null;
  issuedById?: string | null;
  ip?: string | null;
}

export interface BillingResult {
  generated: number;
  skipped: number;
  invoices: {
    id: string;
    invoiceNumber: string;
    studentName: string;
    admissionNumber: string;
    amount: number;
    discountAmount: number;
  }[];
  error?: string;
}

export function applyDiscountValue(discount: Discount, amount: number): number {
  const value = Number(discount.value);
  if (discount.type === "WAIVER") return money(amount);
  if (discount.type === "PERCENTAGE" || discount.type === "SCHOLARSHIP" || discount.type === "SIBLING" || discount.type === "STAFF") {
    return money(Math.min(amount, (amount * value) / 100));
  }
  return money(Math.min(amount, value)); // FIXED
}

export function validateDiscountForInvoice(
  discount: Discount | null,
  ctx: { studentIds: string[]; classIds: string[] }
): string | null {
  if (!discount) return null;
  if (discount.status !== "APPROVED" && discount.status !== "ACTIVE") return "Discount is not approved yet";
  if (discount.validUntil && discount.validUntil < new Date()) return "Discount has expired";
  if (discount.scope === "STUDENT" && discount.studentId && !ctx.studentIds.includes(discount.studentId)) {
    return "Discount does not apply to this student";
  }
  if (discount.scope === "CLASS" && discount.classId && !ctx.classIds.includes(discount.classId)) {
    return "Discount does not apply to this class";
  }
  return null;
}

/**
 * Bulk bill students: one invoice per student bundling the applicable
 * fees. Skips students who already have an open invoice for the term
 * (duplicate prevention); cancelled/draft invoices allow re-billing.
 */
export async function generateInvoices(input: GenerateBillingInput): Promise<BillingResult> {
  const { schoolId, sessionId, termId } = input;

  const studentWhere: Prisma.StudentWhereInput = { schoolId, isActive: true };
  if (input.studentIds?.length) studentWhere.id = { in: input.studentIds };
  else if (input.classId) studentWhere.classId = input.classId;

  const students = await prisma.student.findMany({
    where: studentWhere,
    select: { id: true, firstName: true, lastName: true, admissionNumber: true, classId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  if (students.length === 0) return { generated: 0, skipped: 0, invoices: [] };

  const feeWhere: Prisma.FeeWhereInput = { schoolId, isActive: true };
  if (input.feeIds?.length) feeWhere.id = { in: input.feeIds };
  else if (input.departmentId) feeWhere.departmentId = input.departmentId;
  else feeWhere.departmentId = null; // general (school-wide) fees

  const fees = await prisma.fee.findMany({
    where: feeWhere,
    select: { id: true, name: true, amount: true, classId: true, dueDate: true, isRecurring: true },
  });
  if (fees.length === 0) return { generated: 0, skipped: 0, invoices: [] };

  const existing = await prisma.invoice.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
      sessionId,
      termId,
      status: { in: ["ISSUED", "PARTIAL", "PAID", "OVERDUE"] },
    },
    select: { studentId: true },
  });
  const alreadyBilled = new Set(existing.map((e) => e.studentId));

  let discount: Discount | null = null;
  if (input.discountId) {
    discount = await prisma.discount.findFirst({ where: { id: input.discountId, schoolId } });
    const issue = validateDiscountForInvoice(discount, {
      studentIds: students.map((s) => s.id),
      classIds: [...new Set(students.map((s) => s.classId).filter(Boolean))] as string[],
    });
    if (issue) return { generated: 0, skipped: 0, invoices: [], error: issue };
    if (discount?.status === "APPROVED") {
      await prisma.discount.update({ where: { id: discount.id }, data: { status: "ACTIVE", appliedAt: new Date() } });
      discount = { ...discount, status: "ACTIVE", appliedAt: new Date() };
    }
  }

  const invoices: BillingResult["invoices"] = [];
  let generated = 0;
  let skipped = 0;

  for (const student of students) {
    if (alreadyBilled.has(student.id)) {
      skipped += 1;
      continue;
    }
    const applicable = fees.filter((f) => !f.classId || f.classId === student.classId);
    if (applicable.length === 0) {
      skipped += 1;
      continue;
    }

    const amount = money(applicable.reduce((sum, f) => sum + Number(f.amount), 0));
    const discountAmount = discount ? applyDiscountValue(discount, amount) : 0;
    const invoiceNumber = await nextNumber({ schoolId, kind: "INVOICE" });
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : applicable.reduce<Date | null>((latest, f) => (f.dueDate && (!latest || f.dueDate > latest) ? f.dueDate : latest), null);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        studentId: student.id,
        sessionId,
        termId,
        status: "ISSUED",
        amount,
        discountAmount,
        paidAmount: 0,
        dueDate,
        issuedById: input.issuedById ?? null,
        issuedAt: new Date(),
        discountId: discount?.id ?? null,
        items: {
          create: applicable.map((f) => ({ description: f.name, amount: f.amount, feeId: f.id })),
        },
      },
      include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
    });

    await logFinanceAudit({
      actorId: input.issuedById,
      action: "INVOICE_GENERATE",
      entity: "Invoice",
      entityId: invoice.id,
      newValue: { invoiceNumber, studentId: student.id, amount, discountAmount, termId },
      ip: input.ip,
    });

    generated += 1;
    invoices.push({
      id: invoice.id,
      invoiceNumber,
      studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
      admissionNumber: invoice.student.admissionNumber,
      amount,
      discountAmount,
    });
  }

  return { generated, skipped, invoices };
}
