import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth, requireRole } from "@/lib/auth";
import { ALL_ROLES } from "@/lib/exams/guards";

/**
 * GET /api/report-cards/verify?code=xxx
 * Public-ish verification for QR codes (architecture ready): returns the
 * student name, session, term, average, grade and position without
 * exposing the full card. Any authenticated user may verify.
 */
export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ALL_ROLES, { schoolScoped: true });
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const reportCard = await prisma.reportCard.findUnique({
    where: { verificationCode: code },
    include: {
      student: { select: { firstName: true, lastName: true, admissionNumber: true } },
      session: { select: { name: true } },
      term: { select: { name: true } },
      class: { select: { name: true } },
    },
  });
  if (!reportCard) return NextResponse.json({ error: "Invalid verification code" }, { status: 404 });

  return NextResponse.json({
    verified: true,
    studentName: reportCard.student.firstName + " " + reportCard.student.lastName,
    admissionNumber: reportCard.student.admissionNumber,
    className: reportCard.class.name,
    sessionName: reportCard.session.name,
    termName: reportCard.term.name,
    overallAverage: Number(reportCard.overallAverage),
    overallGrade: reportCard.overallGrade,
    classPosition: reportCard.classPosition,
    totalStudents: reportCard.totalStudents,
    isPublished: reportCard.isPublished,
  });
}
