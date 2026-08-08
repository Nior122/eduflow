import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, feeCategorySchema, feeCategoryUpdateSchema } from "@/lib/validations";
import { financeGuard } from "@/lib/finance/guards";
import { logFinanceAudit } from "@/lib/finance/audit";
import { Prisma } from "@prisma/client";

export async function GET() {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const categories = await prisma.feeCategory.findMany({
    where: { schoolId },
    include: { _count: { select: { fees: true } } },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await req.json();
    const parsed = validate(feeCategorySchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const category = await prisma.feeCategory.create({
      data: { ...parsed.data, schoolId },
    });
    await logFinanceAudit({
      actorId: g.session?.user?.id ?? null,
      action: "FEECATEGORY_CREATE",
      entity: "FeeCategory",
      entityId: category.id,
      newValue: { name: category.name },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    console.error("Failed to create fee category:", error);
    return NextResponse.json({ error: "Failed to create fee category" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const body = await req.json();
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const parsed = validate(feeCategoryUpdateSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const existing = await prisma.feeCategory.findFirst({ where: { id, schoolId } });
  if (!existing) return NextResponse.json({ error: "Fee category not found" }, { status: 404 });

  const category = await prisma.feeCategory.update({
    where: { id },
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description,
      color: parsed.data.color,
      sortOrder: parsed.data.sortOrder,
    },
  });
  await logFinanceAudit({
    actorId: g.session?.user?.id ?? null,
    action: "FEECATEGORY_UPDATE",
    entity: "FeeCategory",
    entityId: id,
    oldValue: { name: existing.name },
    newValue: { name: category.name },
  });
  return NextResponse.json({ category });
}

export async function DELETE(req: Request) {
  const g = await financeGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = await prisma.feeCategory.findFirst({ where: { id, schoolId } });
  if (!existing) return NextResponse.json({ error: "Fee category not found" }, { status: 404 });

  const feeCount = await prisma.fee.count({ where: { feeCategoryId: id } });
  if (feeCount > 0) {
    return NextResponse.json({ error: "Cannot delete a category that has fees" }, { status: 409 });
  }

  await prisma.feeCategory.delete({ where: { id } });
  await logFinanceAudit({
    actorId: g.session?.user?.id ?? null,
    action: "FEECATEGORY_DELETE",
    entity: "FeeCategory",
    entityId: id,
    oldValue: { name: existing.name },
  });
  return NextResponse.json({ success: true });
}
