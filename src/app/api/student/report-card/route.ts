import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STUDENT_ROLES = ["STUDENT"] as const;

/** GET /api/student/report-card — the student's published report cards. */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, STUDENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const studentId = session?.user?.studentId;
  if (!studentId) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

  const reportCards = await prisma.reportCard.findMany({
    where: { studentId, isPublished: true },
    include: {
      session: { select: { name: true } },
      term: { select: { name: true } },
      class: { select: { name: true } },
    },
    orderBy: [{ session: { name: "desc" } }, { term: { name: "desc" } }],
  });

  return NextResponse.json({
    reportCards: reportCards.map((rc) => ({
      id: rc.id,
      sessionName: rc.session.name,
      termName: rc.term.name,
      className: rc.class.name,
      overallAverage: Number(rc.overallAverage),
      overallGrade: rc.overallGrade,
      classPosition: rc.classPosition,
      totalStudents: rc.totalStudents,
      promotionStatus: rc.promotionStatus,
      classTeacherComment: rc.classTeacherComment,
      principalComment: rc.principalComment,
      verificationCode: rc.verificationCode,
      publishedAt: rc.publishedAt?.toISOString() ?? null,
    })),
  });
}
