import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, examinationUpdateSchema } from "@/lib/validations";
import { adminGuard } from "@/lib/exams/guards";
import { Prisma } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  try {
    const existing = await prisma.examination.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Examination not found" }, { status: 404 });

    const body = await req.json();
    const parsed = validate(examinationUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const { classIds, ...fields } = data;

    const examination = await prisma.$transaction(async (tx) => {
      const updated = await tx.examination.update({
        where: { id },
        data: {
          name: fields.name,
          type: fields.type,
          description: fields.description,
          status: fields.status,
          startDate: fields.startDate ? new Date(fields.startDate) : fields.startDate === null ? null : undefined,
          endDate: fields.endDate ? new Date(fields.endDate) : fields.endDate === null ? null : undefined,
          sessionId: fields.sessionId,
          termId: fields.termId,
        },
      });
      if (classIds) {
        await tx.examinationClass.deleteMany({ where: { examinationId: id } });
        if (classIds.length) {
          await tx.examinationClass.createMany({
            data: classIds.map((classId) => ({ examinationId: id, classId })),
          });
        }
      }
      return updated;
    });

    return NextResponse.json({ examination });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Duplicate examination name for this session/term" }, { status: 409 });
    }
    console.error("Failed to update examination:", error);
    return NextResponse.json({ error: "Failed to update examination" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await adminGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;
  const { id } = await params;

  const existing = await prisma.examination.findFirst({ where: { id, schoolId } });
  if (!existing) return NextResponse.json({ error: "Examination not found" }, { status: 404 });

  const scoreCount = await prisma.assessmentScore.count({ where: { examinationId: id } });
  if (scoreCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete: scores have already been entered for this examination. Archive it instead." },
      { status: 409 }
    );
  }

  await prisma.examination.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
