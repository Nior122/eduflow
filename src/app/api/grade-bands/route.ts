import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, gradeBandBulkSchema, gradeBandSchema } from "@/lib/validations";
import { adminGuard } from "@/lib/exams/guards";

export async function GET() {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const gradeBands = await prisma.gradeBand.findMany({
    where: { schoolId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ gradeBands });
}

/** Replace the school's entire grading scale in one call. */
export async function POST(req: Request) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const body = await req.json();
  const parsed = validate(gradeBandBulkSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  // bands must not overlap
  const sorted = [...parsed.data.bands].sort((a, b) => a.minScore - b.minScore);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minScore <= sorted[i - 1].maxScore) {
      return NextResponse.json(
        { error: `Grade bands overlap: ${sorted[i - 1].name} and ${sorted[i].name}` },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction([
    prisma.gradeBand.deleteMany({ where: { schoolId } }),
    prisma.gradeBand.createMany({
      data: parsed.data.bands.map((b) => ({ ...b, schoolId })),
    }),
  ]);

  const gradeBands = await prisma.gradeBand.findMany({
    where: { schoolId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ gradeBands });
}

/** Create a single band (for schools that prefer incremental edits). */
export async function PUT(req: Request) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const body = await req.json();
  const parsed = validate(gradeBandSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const gradeBand = await prisma.gradeBand.create({ data: { ...parsed.data, schoolId } });
  return NextResponse.json({ gradeBand }, { status: 201 });
}
