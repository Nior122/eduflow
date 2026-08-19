import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, planCreateSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { createPaymentPlan, PaymentError } from "@/lib/finance/payments";

/** GET /api/finance/plans — list with filters (?studentId&status). */
export async function GET(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const status = searchParams.get("status");

  const plans = await prisma.paymentPlan.findMany({
    where: {
      student: { schoolId },
      ...(studentId ? { studentId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      invoice: { select: { invoiceNumber: true, amount: true, discountAmount: true, paidAmount: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    plans: plans.map((p) => ({
      ...p,
      totalAmount: Number(p.totalAmount),
      installmentAmount: Number(p.installmentAmount),
    })),
  });
}

/** POST /api/finance/plans — create a payment plan for a student/invoice. */
export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(planCreateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const plan = await createPaymentPlan({
      schoolId,
      studentId: data.studentId,
      invoiceId: data.invoiceId,
      totalAmount: data.totalAmount,
      installmentAmount: data.installmentAmount,
      installmentCount: data.installmentCount,
      frequency: data.frequency,
      startDate: data.startDate ?? null,
      dueDate: data.dueDate ?? null,
      createdById: g.session?.user?.id ?? null,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to create plan:", error);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
