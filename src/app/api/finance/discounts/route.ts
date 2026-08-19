import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, discountCreateSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { createDiscount, DiscountError } from "@/lib/finance/discounts";

/** GET /api/finance/discounts — list with filters (?status&type&studentId). */
export async function GET(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const discounts = await prisma.discount.findMany({
    where: {
      schoolId,
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as never } : {}),
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      class: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      _count: { select: { invoices: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ discounts });
}

/** POST /api/finance/discounts — create (status PENDING until approved). */
export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(discountCreateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const discount = await createDiscount({
      schoolId,
      name: data.name,
      code: data.code,
      type: data.type,
      value: data.value,
      scope: data.scope,
      studentId: data.studentId,
      classId: data.classId,
      feeId: data.feeId,
      reason: data.reason,
      validUntil: data.validUntil ?? null,
      createdById: g.session?.user?.id ?? null,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });
    return NextResponse.json({ discount }, { status: 201 });
  } catch (error) {
    if (error instanceof DiscountError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to create discount:", error);
    return NextResponse.json({ error: "Failed to create discount" }, { status: 500 });
  }
}
