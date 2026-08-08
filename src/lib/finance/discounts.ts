// ─── Phase 5: discounts & scholarships ───────────────────────────────
import { prisma } from "@/lib/db";
import { logFinanceAudit } from "./audit";
import { isPercentType } from "./types";
import type { DiscountStatus, DiscountType } from "@prisma/client";

export class DiscountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscountError";
  }
}

export interface CreateDiscountInput {
  schoolId: string;
  name: string;
  code?: string;
  type: DiscountType;
  value: number;
  scope: "STUDENT" | "CLASS" | "SCHOOL" | "FEE";
  studentId?: string;
  classId?: string;
  feeId?: string;
  reason?: string;
  validUntil?: string | null;
  createdById?: string | null;
  ip?: string | null;
}

export async function createDiscount(input: CreateDiscountInput) {
  const value = Math.round(input.value * 100) / 100;
  if (value < 0) throw new DiscountError("Discount value cannot be negative");
  if (isPercentType(input.type) && value > 100) {
    throw new DiscountError("Invalid discount: percentage-type discounts must be between 0 and 100");
  }

  if (input.scope === "STUDENT") {
    if (!input.studentId) throw new DiscountError("Student scope requires a student");
    const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId: input.schoolId } });
    if (!student) throw new DiscountError("Student not found");
  }
  if (input.scope === "CLASS") {
    if (!input.classId) throw new DiscountError("Class scope requires a class");
    const cls = await prisma.class.findFirst({ where: { id: input.classId, schoolId: input.schoolId } });
    if (!cls) throw new DiscountError("Class not found");
  }
  if (input.scope === "FEE") {
    if (!input.feeId) throw new DiscountError("Fee scope requires a fee");
    const fee = await prisma.fee.findFirst({ where: { id: input.feeId, schoolId: input.schoolId } });
    if (!fee) throw new DiscountError("Fee not found");
  }

  const discount = await prisma.discount.create({
    data: {
      name: input.name,
      code: input.code ?? null,
      type: input.type,
      value,
      scope: input.scope,
      studentId: input.scope === "STUDENT" ? input.studentId : null,
      classId: input.scope === "CLASS" ? input.classId : null,
      feeId: input.scope === "FEE" ? input.feeId : null,
      reason: input.reason ?? null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      status: "PENDING",
      schoolId: input.schoolId,
      createdById: input.createdById ?? null,
    },
  });

  await logFinanceAudit({
    actorId: input.createdById,
    action: "DISCOUNT_CREATE",
    entity: "Discount",
    entityId: discount.id,
    newValue: { name: input.name, type: input.type, value, scope: input.scope, status: "PENDING" },
    ip: input.ip,
  });
  return discount;
}

/** Approval workflow: PENDING → APPROVED | REJECTED. */
export async function reviewDiscount(opts: {
  discountId: string;
  schoolId: string;
  action: "APPROVE" | "REJECT";
  actorId?: string | null;
  note?: string;
}) {
  const discount = await prisma.discount.findFirst({
    where: { id: opts.discountId, schoolId: opts.schoolId },
  });
  if (!discount) throw new DiscountError("Discount not found");
  if (discount.status !== "PENDING") {
    throw new DiscountError(`Only pending discounts can be ${opts.action.toLowerCase()}d (current: ${discount.status})`);
  }

  const status: DiscountStatus = opts.action === "APPROVE" ? "APPROVED" : "REJECTED";
  const updated = await prisma.discount.update({
    where: { id: discount.id },
    data: { status, approvedById: opts.actorId ?? null, approvedAt: new Date() },
  });
  await logFinanceAudit({
    actorId: opts.actorId,
    action: `DISCOUNT_${opts.action}`,
    entity: "Discount",
    entityId: discount.id,
    oldValue: { status: discount.status },
    newValue: { status, note: opts.note ?? null },
  });
  return updated;
}
