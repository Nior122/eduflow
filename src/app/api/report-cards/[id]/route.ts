import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, reportCardUpdateSchema } from "@/lib/validations";
import { auth, requireRole } from "@/lib/auth";
import { buildReportCard } from "@/lib/exams/report-card";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/exams/guards";

const COMMENT_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;
const VIEW_ROLES = ["STUDENT", "PARENT", "TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

/**
 * GET /api/report-cards/[id] — full regenerated card.
 * Admins/teachers: any school card. Students: own. Parents: children's.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const denied = requireRole(session, VIEW_ROLES, { schoolScoped: true });
  if (denied) return denied;

  const { id } = await params;
  const reportCard = await prisma.reportCard.findUnique({
    where: { id },
    include: { student: { select: { id: true, parentId: true, schoolId: true } } },
  });
  if (!reportCard || reportCard.student.schoolId !== session?.user?.schoolId) {
    return NextResponse.json({ error: "Report card not found" }, { status: 404 });
  }

  const role = session?.user?.role;
  if (role === "STUDENT" && session?.user?.studentId !== reportCard.studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "PARENT" && session?.user?.parentId !== reportCard.student.parentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await buildReportCard({
    studentId: reportCard.studentId,
    sessionId: reportCard.sessionId,
    termId: reportCard.termId,
    generatedById: session?.user?.id ?? null,
  });
  if (!data) return NextResponse.json({ error: "Report card unavailable" }, { status: 404 });
  return NextResponse.json({ reportCard: data });
}

/**
 * PATCH /api/report-cards/[id]
 * Body: { classTeacherComment?, principalComment?, isPublished? }
 * Teachers may set the class-teacher comment; principals/admins set the
 * principal comment and publish. Returns the full regenerated card.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const denied = requireRole(session, COMMENT_ROLES, { schoolScoped: true });
  if (denied) return denied;

  const { id } = await params;
  const reportCard = await prisma.reportCard.findUnique({
    where: { id },
    include: { student: { select: { schoolId: true } } },
  });
  if (!reportCard || reportCard.student.schoolId !== session?.user?.schoolId) {
    return NextResponse.json({ error: "Report card not found" }, { status: 404 });
  }

  const body = await parseJsonBody(req);
  const parsed = validate(reportCardUpdateSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
  }

  const role = session?.user?.role;
  const isAdmin = ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);

  if (!isAdmin && parsed.data.principalComment !== undefined) {
    return NextResponse.json({ error: "Only administrators can set the principal comment" }, { status: 403 });
  }
  if (!isAdmin && parsed.data.isPublished !== undefined) {
    return NextResponse.json({ error: "Only administrators can publish report cards" }, { status: 403 });
  }
  if (role === "TEACHER" && parsed.data.classTeacherComment !== undefined) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: session?.user?.teacherId ?? "" },
      select: { id: true },
    });
    if (!teacher) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
  }

  await prisma.reportCard.update({
    where: { id },
    data: {
      classTeacherComment:
        parsed.data.classTeacherComment !== undefined
          ? parsed.data.classTeacherComment
          : undefined,
      principalComment:
        parsed.data.principalComment !== undefined
          ? parsed.data.principalComment
          : undefined,
      isPublished:
        parsed.data.isPublished !== undefined
          ? parsed.data.isPublished
          : undefined,
      publishedAt:
        parsed.data.isPublished === true ? new Date() : undefined,
    },
  });

  const data = await buildReportCard({
    studentId: reportCard.studentId,
    sessionId: reportCard.sessionId,
    termId: reportCard.termId,
    generatedById: session?.user?.id ?? null,
  });
  return NextResponse.json({ reportCard: data });
}
