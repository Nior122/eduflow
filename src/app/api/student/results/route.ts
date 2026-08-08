import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STUDENT_ROLES = ["STUDENT"] as const;

/**
 * GET /api/student/results — the student's report cards + per-term
 * subject results (published only).
 */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, STUDENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const studentId = session?.user?.studentId;
  if (!studentId) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

  const [reportCards, results] = await Promise.all([
    prisma.reportCard.findMany({
      where: { studentId },
      include: { session: true, term: true, class: true },
      orderBy: [{ session: { name: "asc" } }, { term: { name: "asc" } }],
    }),
    prisma.result.findMany({
      where: {
        studentId,
        status: { in: ["PUBLISHED", "LOCKED"] },
      },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { subject: { name: "asc" } },
    }),
  ]);

  const byTerm = new Map<string, typeof results>();
  for (const r of results) {
    const key = r.academicSessionId + ":" + r.academicTermId;
    const arr = byTerm.get(key) ?? [];
    arr.push(r);
    byTerm.set(key, arr);
  }

  return NextResponse.json({
    reportCards: reportCards.map((rc) => ({
      id: rc.id,
      sessionName: rc.session.name,
      termName: rc.term.name,
      className: rc.class.name,
      overallAverage: Number(rc.overallAverage),
      overallGrade: rc.overallGrade,
      classPosition: rc.classPosition,
      promotionStatus: rc.promotionStatus,
      isPublished: rc.isPublished,
      verificationCode: rc.verificationCode,
    })),
    resultsByTerm: [...byTerm.entries()].map(([key, rows]) => ({
      sessionId: key.split(":")[0],
      termId: key.split(":")[1],
      rows: rows.map((r) => ({
        subjectName: r.subject.name,
        caScore: Number(r.caScore ?? 0),
        examScore: Number(r.examScore ?? 0),
        total: Number(r.percentage ?? r.total ?? 0),
        grade: r.grade,
        remark: r.remark,
        subjectPosition: r.subjectPosition,
        totalStudents: r.totalStudents,
      })),
    })),
  });
}
