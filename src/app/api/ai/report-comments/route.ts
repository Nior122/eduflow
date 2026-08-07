import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, reportCommentSaveSchema } from "@/lib/validations";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(STAFF_ROLES as readonly string[]).includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const schoolId = session.user.schoolId;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  const comments = await prisma.aIReportComment.findMany({
    where: {
      student: { schoolId },
      ...(studentId ? { studentId } : {}),
    },
    include: {
      student: { select: { firstName: true, lastName: true, admissionNumber: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ comments });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(STAFF_ROLES as readonly string[]).includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const schoolId = session.user.schoolId;

  try {
    const body = await req.json();
    const parsed = validate(reportCommentSaveSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { studentId, comment } = parsed.data;

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId, isActive: true },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const saved = await prisma.aIReportComment.create({
      data: {
        content: comment,
        studentId,
        teacherId: session.user.teacherId ?? null,
      },
    });
    return NextResponse.json({ comment: saved }, { status: 201 });
  } catch (error) {
    console.error("Failed to save comment:", error);
    return NextResponse.json({ error: "Failed to save comment" }, { status: 500 });
  }
}
