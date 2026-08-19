import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, assessmentTypeSchema, assessmentTypeUpdateSchema } from "@/lib/validations";
import { adminGuard } from "@/lib/exams/guards";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const termId = searchParams.get("termId");

  const types = await prisma.assessmentType.findMany({
    where: { schoolId },
    include: {
      configs: termId ? { where: { termId } } : true,
      _count: { select: { scores: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ assessmentTypes: types });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(assessmentTypeSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const assessmentType = await prisma.assessmentType.create({
      data: { ...parsed.data, schoolId },
    });
    return NextResponse.json({ assessmentType }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An assessment type with this name already exists" }, { status: 409 });
    }
    console.error("Failed to create assessment type:", error);
    return NextResponse.json({ error: "Failed to create assessment type" }, { status: 500 });
  }
}

/** Bulk upsert of per-term config (weights/max scores) for a term. */
export async function PATCH(req: Request) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const body = await parseJsonBody(req);
  const termId = body?.termId as string | undefined;
  const items = (body?.items ?? []) as { assessmentTypeId: string; weight: number; maxScore: number }[];
  if (!termId || !items.length) {
    return NextResponse.json({ error: "termId and items are required" }, { status: 400 });
  }

  const term = await prisma.academicTerm.findFirst({
    where: { id: termId, OR: [{ schoolId }, { schoolId: null }] },
  });
  if (!term) return NextResponse.json({ error: "Term not found" }, { status: 404 });

  const valid = await prisma.assessmentType.count({
    where: { id: { in: items.map((i) => i.assessmentTypeId) }, schoolId },
  });
  if (valid !== items.length) {
    return NextResponse.json({ error: "Unknown assessment type" }, { status: 400 });
  }

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (totalWeight !== 100) {
    return NextResponse.json({ error: `Weights must total 100% (currently ${totalWeight}%)` }, { status: 400 });
  }

  await prisma.$transaction(
    items.map((i) =>
      prisma.termAssessmentConfig.upsert({
        where: { termId_assessmentTypeId: { termId, assessmentTypeId: i.assessmentTypeId } },
        update: { weight: i.weight, maxScore: i.maxScore },
        create: { termId, assessmentTypeId: i.assessmentTypeId, weight: i.weight, maxScore: i.maxScore },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
