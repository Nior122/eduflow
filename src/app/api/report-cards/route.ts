import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, reportCardGenerateSchema } from "@/lib/validations";
import { staffGuard } from "@/lib/exams/guards";
import { buildReportCard } from "@/lib/exams/report-card";

/** GET /api/report-cards?classId&sessionId&termId (admin/staff view) */
export async function GET(req: Request) {
  const g = await staffGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");
  const studentId = searchParams.get("studentId");

  const where: Record<string, unknown> = { student: { schoolId } };
  if (classId) where.classId = classId;
  if (sessionId) where.sessionId = sessionId;
  if (termId) where.termId = termId;
  if (studentId) where.studentId = studentId;

  const reportCards = await prisma.reportCard.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, profileImage: true } },
      session: { select: { name: true } },
      term: { select: { name: true } },
      class: { select: { name: true } },
    },
    orderBy: [{ student: { lastName: "asc" } }, { session: { name: "desc" } }],
  });
  return NextResponse.json({ reportCards });
}

/**
 * POST /api/report-cards — generate report cards.
 * Body: { sessionId, termId, classId? | studentId? }
 * Without classId/studentId: regenerate for every student with published results.
 */
export async function POST(req: Request) {
  const g = await staffGuard();
  if (g.denied) return g.denied;
  const schoolId = g.schoolId!;

  const body = await parseJsonBody(req);
  const parsed = validate(reportCardGenerateSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }
  const { sessionId, termId, classId, studentId } = parsed.data;

  let students: { id: string }[] = [];
  if (studentId) {
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    students = student ? [student] : [];
  } else if (classId) {
    students = await prisma.student.findMany({
      where: { classId, schoolId, isActive: true },
      select: { id: true },
    });
  } else {
    // every student with at least one published result this term
    const withResults = await prisma.result.findMany({
      where: {
        academicSessionId: sessionId,
        academicTermId: termId,
        status: { in: ["PUBLISHED", "LOCKED"] },
        class: { schoolId },
      },
      distinct: ["studentId"],
      select: { studentId: true },
    });
    students = withResults.map((r) => ({ id: r.studentId }));
  }

  let generated = 0;
  const skipped: string[] = [];
  for (const s of students) {
    const card = await buildReportCard({
      studentId: s.id,
      sessionId,
      termId,
      generatedById: g.session?.user?.id ?? null,
    });
    if (card) generated += 1;
    else skipped.push(s.id);
  }

  return NextResponse.json({ generated, skipped: skipped.length }, { status: 201 });
}
