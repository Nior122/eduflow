import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, assessmentTypeUpdateSchema } from "@/lib/validations";
import { adminGuard } from "@/lib/exams/guards";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const existing = await prisma.assessmentType.findFirst({ where: { id, schoolId } });
  if (!existing) return NextResponse.json({ error: "Assessment type not found" }, { status: 404 });

  const body = await req.json();
  const parsed = validate(assessmentTypeUpdateSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const assessmentType = await prisma.assessmentType.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ assessmentType });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const existing = await prisma.assessmentType.findFirst({ where: { id, schoolId } });
  if (!existing) return NextResponse.json({ error: "Assessment type not found" }, { status: 404 });

  const scoreCount = await prisma.assessmentScore.count({ where: { assessmentTypeId: id } });
  if (scoreCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete: scores exist for this assessment type. Deactivate it instead." },
      { status: 409 }
    );
  }

  await prisma.assessmentType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
