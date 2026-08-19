import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, recalculateSchema } from "@/lib/validations";
import { staffGuard, assertTeacherAssignment } from "@/lib/exams/guards";
import { upsertComputedResult } from "@/lib/exams/calculator";
import { recomputePositions } from "@/lib/exams/positions";
import { Prisma } from "@prisma/client";

/**
 * POST /api/scores/recalculate — recompute Result rows (weighted totals,
 * grades, remarks) from raw AssessmentScores for a class × subject × term,
 * then recompute subject/class positions.
 */
export async function POST(req: Request) {
  const g = await staffGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(recalculateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { classId, subjectId, sessionId, termId } = parsed.data;

    const denied = await assertTeacherAssignment({
      teacherId: g.session?.user?.teacherId ?? null,
      role: g.session?.user?.role,
      classId,
      subjectId,
      sessionId,
      termId,
    });
    if (denied) return denied;

    const [term, session, classRow, students] = await Promise.all([
      prisma.academicTerm.findUnique({ where: { id: termId } }),
      prisma.academicSession.findUnique({ where: { id: sessionId } }),
      prisma.class.findUnique({ where: { id: classId } }),
      prisma.student.findMany({ where: { classId, isActive: true }, select: { id: true } }),
    ]);
    if (!term || !session || !classRow) {
      return NextResponse.json({ error: "Invalid class, session or term" }, { status: 404 });
    }

    let computed = 0;
    let missingScores = 0;
    const results = [];

    for (const student of students) {
      const hasScores = await prisma.assessmentScore.count({
        where: { studentId: student.id, subjectId, sessionId, termId },
      });
      if (hasScores === 0) {
        missingScores += 1;
        continue;
      }
      const result = await upsertComputedResult({
        schoolId,
        studentId: student.id,
        subjectId,
        classId,
        sessionId,
        termId,
        termName: term.name,
        sessionName: session.name,
        teacherId: g.session?.user?.teacherId ?? null,
      });
      if (result) {
        computed += 1;
        results.push(result.id);
      }
    }

    const ranked = await recomputePositions({ schoolId, classId, subjectId, sessionId, termId });

    return NextResponse.json({
      computed,
      missingScores,
      ranked,
      status: "ok",
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Recalculate failed (prisma):", error.message);
      return NextResponse.json({ error: "Recalculate failed: " + error.message }, { status: 500 });
    }
    console.error("Recalculate failed:", error);
    return NextResponse.json({ error: "Recalculate failed" }, { status: 500 });
  }
}
