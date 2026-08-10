import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/ai/exams/[id] — full generated exam (print view). */
export async function GET(_req: Request, { params }: RouteCtx) {
  const guard = await aiGuard({ module: "exam_generator", roles: STAFF_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { schoolId } = guard;

  const { id } = await params;
  const exam = await prisma.generatedExam.findFirst({
    where: { id, schoolId },
    include: { subject: { select: { name: true } }, class: { select: { name: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  return NextResponse.json({
    exam: {
      id: exam.id,
      title: exam.title,
      instructions: exam.instructions,
      durationMins: exam.durationMins,
      sections: exam.sections,
      markingScheme: exam.markingScheme,
      answerKey: exam.answerKey,
      difficultyCoverage: exam.difficultyCoverage,
      subject: exam.subject?.name ?? null,
      className: exam.class?.name ?? null,
      createdAt: exam.createdAt.toISOString(),
    },
  });
}

/** DELETE /api/ai/exams/[id] — remove a generated exam (author or admin). */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const guard = await aiGuard({ module: "exam_generator", roles: STAFF_ROLES, budgetCheck: false });
  if (guard instanceof NextResponse) return guard;
  const { session, schoolId } = guard;

  const { id } = await params;
  const isAdmin = session.user.role === "SCHOOL_ADMIN" || session.user.role === "SUPER_ADMIN";
  const exam = await prisma.generatedExam.findFirst({
    where: { id, schoolId },
    select: { id: true, createdById: true },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  if (!isAdmin && exam.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.generatedExam.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
