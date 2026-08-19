import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, assignmentSchema } from "@/lib/validations";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const schoolId = session.user.schoolId;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const subjectId = searchParams.get("subjectId");

  const where: Record<string, unknown> = { schoolId };
  if (classId) where.classId = classId;
  if (subjectId) where.subjectId = subjectId;

  if (session.user.role === "TEACHER") {
    where.teacherId = session.user.teacherId ?? "__none__";
  } else if (session.user.role === "STUDENT") {
    const studentId = session.user.studentId;
    if (!studentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    where.class = { students: { some: { id: studentId } } };
    // For students, only show non-deleted class assignments (no soft-delete field; filter by class isActive)
    where.class = { students: { some: { id: studentId } }, isActive: true };
  }

  const assignments = await prisma.assignment.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { submissions: true } },
      submissions: session.user.role === "STUDENT"
        ? { where: { studentId: session.user.studentId ?? "__none__" }, select: { id: true, grade: true, submittedAt: true, feedback: true } }
        : false,
    },
    orderBy: { dueDate: "desc" },
    take: 100,
  });
  return NextResponse.json({ assignments });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(assignmentSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const data = parsed.data;

    const [cls, subject] = await Promise.all([
      prisma.class.findFirst({ where: { id: data.classId, schoolId, isActive: true }, select: { id: true } }),
      prisma.subject.findFirst({ where: { id: data.subjectId, schoolId, isActive: true }, select: { id: true } }),
    ]);
    if (!cls || !subject) return NextResponse.json({ error: "Class or subject not found" }, { status: 404 });

    const assignment = await prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        dueDate: new Date(data.dueDate),
        maxScore: data.maxScore ?? null,
        attachments: data.attachments ?? null,
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId: session.user.teacherId ?? null,
        schoolId,
      },
    });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create assignment:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}
