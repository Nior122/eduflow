import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { staffGuard } from "@/lib/exams/guards";
import { STATUS_LABEL, STATUS_BADGE } from "@/lib/exams/workflow";

/**
 * GET /api/results/result-sheet?classId&subjectId&sessionId&termId&status
 * Full result sheet for the approval workflow: students with totals,
 * grades, positions, workflow status and audit trail.
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
  const status = searchParams.get("status");

  if (!classId || !subjectId || !sessionId || !termId) {
    return NextResponse.json({ error: "classId, subjectId, sessionId and termId are required" }, { status: 400 });
  }

  const [classRow, subjectRow, sessionRow, termRow, results, scores] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId, schoolId } }),
    prisma.subject.findUnique({ where: { id: subjectId, schoolId } }),
    prisma.academicSession.findUnique({ where: { id: sessionId } }),
    prisma.academicTerm.findUnique({ where: { id: termId } }),
    prisma.result.findMany({
      where: {
        classId,
        subjectId,
        academicSessionId: sessionId,
        academicTermId: termId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        approvals: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { student: { lastName: "asc" } },
    }),
    prisma.assessmentScore.findMany({
      where: { classId, subjectId, sessionId, termId },
      include: { assessmentType: { select: { name: true, code: true, kind: true } } },
    }),
  ]);

  if (!classRow || !subjectRow || !sessionRow || !termRow) {
    return NextResponse.json({ error: "Invalid class, subject, session or term" }, { status: 404 });
  }

  return NextResponse.json({
    meta: {
      className: classRow.name,
      subjectName: subjectRow.name,
      sessionName: sessionRow.name,
      termName: termRow.name,
    },
    results,
    scores,
    statusLabels: STATUS_LABEL,
    statusBadges: STATUS_BADGE,
  });
}
