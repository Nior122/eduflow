import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, feeSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { logFinanceAudit } from "@/lib/finance/audit";
import { Prisma } from "@prisma/client";

export async function GET() {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const fees = await prisma.fee.findMany({
    where: { schoolId, isActive: true },
    include: {
      feeCategory: { select: { id: true, name: true, color: true } },
      class: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      _count: { select: { feeRecords: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ fees });
}

export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(feeSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    // resolve optional relations belong to this school
    if (data.feeCategoryId) {
      const cat = await prisma.feeCategory.findFirst({ where: { id: data.feeCategoryId, schoolId } });
      if (!cat) return NextResponse.json({ error: "Fee category not found" }, { status: 404 });
    }
    if (data.classId) {
      const cls = await prisma.class.findFirst({ where: { id: data.classId, schoolId } });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    if (data.departmentId) {
      const dept = await prisma.department.findFirst({ where: { id: data.departmentId, schoolId } });
      if (!dept) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const fee = await prisma.fee.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isOptional: data.isOptional,
        isRecurring: data.isRecurring ?? false,
        lateFee: data.lateFee ?? null,
        term: data.term ?? null,
        session: data.session ?? null,
        schoolId,
        feeCategoryId: data.feeCategoryId ?? null,
        classId: data.classId ?? null,
        departmentId: data.departmentId ?? null,
      },
    });

    await logFinanceAudit({
      actorId: g.session?.user?.id ?? null,
      action: "FEE_CREATE",
      entity: "Fee",
      entityId: fee.id,
      newValue: { name: fee.name, amount: Number(fee.amount), categoryId: fee.feeCategoryId },
    });
    return NextResponse.json({ fee }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This fee already exists" }, { status: 409 });
    }
    console.error("Failed to create fee:", error);
    return NextResponse.json({ error: "Failed to create fee" }, { status: 500 });
  }
}
