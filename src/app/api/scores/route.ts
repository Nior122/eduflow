import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, scoreBulkSchema } from "@/lib/validations";
import { staffGuard, assertTeacherAssignment } from "@/lib/exams/guards";
import { getEffectiveConfigs } from "@/lib/exams/calculator";
import { Prisma } from "@prisma/client";

/**
 * GET /api/scores?classId&subjectId&sessionId&termId
 * Returns the spreadsheet grid: students x assessment types x scores.
 */
export async function GET(req: Request) {
  const g = await staffGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const subjectId = searchParams.get("subjectId");
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");
  if (!classId || !subjectId || !sessionId || !termId) {
    return NextResponse.json({ error: "classId, subjectId, sessionId and termId are required" }, { status: 400 });
  }

  const denied = await assertTeacherAssignment({
    teacherId: g.session?.user?.teacherId ?? null,
    role: g.session?.user?.role,
    classId,
    subjectId,
    sessionId,
    termId,
  });
  if (denied) return denied;

  const [students, configs, scores, resultRows, term] = await Promise.all([
    prisma.student.findMany({
      where: { classId, schoolId, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, gender: true },
    }),
    getEffectiveConfigs({ schoolId, termId }),
    prisma.assessmentScore.findMany({
      where: { classId, subjectId, sessionId, termId },
      select: { id: true, studentId: true, assessmentTypeId: true, score: true, maxScore: true },
    }),
    prisma.result.findMany({
      where: { classId, subjectId, academicSessionId: sessionId, academicTermId: termId },
      select: {
        id: true,
        studentId: true,
        total: true,
        percentage: true,
        caScore: true,
        examScore: true,
        grade: true,
        remark: true,
        status: true,
        subjectPosition: true,
        classPosition: true,
        totalStudents: true,
      },
    }),
    prisma.academicTerm.findUnique({ where: { id: termId } }),
  ]);

  const byKey = new Map(scores.map((s) => [s.studentId + ":" + s.assessmentTypeId, s]));
  const resultsByStudent = new Map(resultRows.map((r) => [r.studentId, r]));

  return NextResponse.json({
    students,
    assessmentTypes: configs,
    termName: term?.name ?? null,
    scores: [...byKey.values()],
    results: [...resultsByStudent.values()],
  });
}

/**
 * POST /api/scores — bulk upsert with validation (no negative, no above
 * max, no duplicates — enforced by the unique constraint and checks here).
 */
export async function POST(req: Request) {
  const g = await staffGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  try {
    const body = await req.json();
    const parsed = validate(scoreBulkSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { classId, subjectId, sessionId, termId, rows } = parsed.data;

    const denied = await assertTeacherAssignment({
      teacherId: g.session?.user?.teacherId ?? null,
      role: g.session?.user?.role,
      classId,
      subjectId,
      sessionId,
      termId,
    });
    if (denied) return denied;

    // Resolve allowed assessment types for this term.
    const configs = await getEffectiveConfigs({ schoolId, termId });
    const configById = new Map(configs.map((c) => [c.assessmentTypeId, c]));

    const uniqueStudentIds = [...new Set(rows.map((r) => r.studentId))];
    const studentCount = await prisma.student.count({
      where: { id: { in: uniqueStudentIds }, classId, schoolId, isActive: true },
    });
    if (studentCount !== uniqueStudentIds.length) {
      return NextResponse.json({ error: "One or more students do not belong to this class" }, { status: 400 });
    }

    const errors: string[] = [];
    const ops = rows.flatMap((row) => {
      const config = configById.get(row.assessmentTypeId);
      if (!config) {
        errors.push("Unknown assessment type " + row.assessmentTypeId);
        return [];
      }
      const maxScore = row.maxScore ?? config.maxScore;
      if (row.score < 0) {
        errors.push("Negative score rejected for student " + row.studentId);
        return [];
      }
      if (row.score > maxScore) {
        errors.push("Score " + row.score + " exceeds maximum " + maxScore);
        return [];
      }
      return [
        prisma.assessmentScore.upsert({
          where: {
            studentId_subjectId_sessionId_termId_assessmentTypeId: {
              studentId: row.studentId,
              subjectId,
              sessionId,
              termId,
              assessmentTypeId: row.assessmentTypeId,
            },
          },
          update: { score: row.score, maxScore, enteredById: g.session?.user?.id ?? null },
          create: {
            studentId: row.studentId,
            subjectId,
            sessionId,
            termId,
            assessmentTypeId: row.assessmentTypeId,
            classId,
            score: row.score,
            maxScore,
            enteredById: g.session?.user?.id ?? null,
          },
        }),
      ];
    });

    if (ops.length === 0) {
      return NextResponse.json(
        { error: "No valid scores to save", issues: errors },
        { status: 400 }
      );
    }

    await prisma.$transaction(ops);

    return NextResponse.json({
      saved: ops.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Duplicate score entry rejected" }, { status: 409 });
    }
    console.error("Failed to save scores:", error);
    return NextResponse.json({ error: "Failed to save scores" }, { status: 500 });
  }
}
