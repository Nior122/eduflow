import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, feeUpdateSchema, feeRecordSchema } from "@/lib/validations";
import { generateReference } from "@/lib/provision";
import { financeGuard } from "@/lib/finance/guards";
import { logFinanceAudit } from "@/lib/finance/audit";
import { Prisma, type FeeStatus } from "@prisma/client";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const fee = await prisma.fee.findFirst({ where: { id, schoolId, isActive: true }, select: { id: true } });
  if (!fee) return NextResponse.json({ error: "Fee not found" }, { status: 404 });

  const feeRecords = await prisma.feeRecord.findMany({
    where: { feeId: id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      payment: { select: { method: true, reference: true, paidAt: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ feeRecords });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = validate(feeUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.fee.findFirst({ where: { id, schoolId }, select: { id: true, name: true } });
    if (!existing) return NextResponse.json({ error: "Fee not found" }, { status: 404 });

    const updateData: Prisma.FeeUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.isOptional !== undefined && { isOptional: data.isOptional }),
      ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
      ...(data.lateFee !== undefined && { lateFee: data.lateFee ?? null }),
      ...(data.term !== undefined && { term: data.term ?? null }),
      ...(data.session !== undefined && { session: data.session ?? null }),
      ...(data.feeCategoryId !== undefined && { feeCategoryId: data.feeCategoryId ?? null }),
      ...(data.classId !== undefined && { classId: data.classId ?? null }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId ?? null }),
    };

    const fee = await prisma.fee.update({ where: { id }, data: updateData });

    await logFinanceAudit({
      actorId: g.session?.user?.id ?? null,
      action: "FEE_UPDATE",
      entity: "Fee",
      entityId: id,
      oldValue: { name: existing.name },
      newValue: { name: fee.name, amount: Number(fee.amount) },
    });
    return NextResponse.json({ fee });
  } catch (error) {
    console.error("Failed to update fee:", error);
    return NextResponse.json({ error: "Failed to update fee" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const existing = await prisma.fee.findFirst({ where: { id, schoolId }, select: { id: true, name: true } });
  if (!existing) return NextResponse.json({ error: "Fee not found" }, { status: 404 });

  const recordCount = await prisma.feeRecord.count({ where: { feeId: id } });
  if (recordCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a fee with payment records — deactivate it instead" },
      { status: 409 }
    );
  }

  await prisma.fee.update({ where: { id }, data: { isActive: false } });
  await logFinanceAudit({
    actorId: g.session?.user?.id ?? null,
    action: "FEE_DELETE",
    entity: "Fee",
    entityId: id,
    oldValue: { name: existing.name },
  });
  return NextResponse.json({ success: true });
}

/** Legacy direct payment against a fee (Phase 1 flow, kept for compatibility). */
export async function POST(req: Request, { params }: RouteCtx) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = validate(feeRecordSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { studentId, amount, method, status: requestedStatus, notes } = parsed.data;

    const fee = await prisma.fee.findFirst({
      where: { id, schoolId, isActive: true },
      select: { id: true, amount: true },
    });
    if (!fee) return NextResponse.json({ error: "Fee not found" }, { status: 404 });

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId, isActive: true },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const existing = await prisma.feeRecord.findUnique({
      where: { feeId_studentId: { feeId: id, studentId } },
      select: { amount: true },
    });

    const cumulative = Number(existing?.amount ?? 0) + amount;
    const recordStatus: FeeStatus =
      requestedStatus === "PENDING" || requestedStatus === "WAIVED"
        ? requestedStatus
        : cumulative >= Number(fee.amount)
          ? "PAID"
          : "PARTIAL";

    const { feeRecord, payment } = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          amount,
          method,
          reference: generateReference("pay"),
          status: recordStatus,
          paidAt: new Date(),
          notes: notes ?? null,
          schoolId,
        },
      });
      const feeRecord = await tx.feeRecord.upsert({
        where: { feeId_studentId: { feeId: id, studentId } },
        create: { feeId: id, studentId, amount: cumulative, status: recordStatus, paidAt: new Date(), paymentId: payment.id },
        update: { amount: cumulative, status: recordStatus, paidAt: new Date(), paymentId: payment.id },
      });
      return { feeRecord, payment };
    });

    return NextResponse.json({ feeRecord, payment }, { status: 201 });
  } catch (error) {
    console.error("Failed to record payment:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
