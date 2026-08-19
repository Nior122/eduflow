import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, resultSchema } from "@/lib/validations";
import { calculateGrade } from "@/lib/utils";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const subjectId = searchParams.get("subjectId");
  const term = searchParams.get("term");
  const sessionYear = searchParams.get("session");

  const where: Record<string, unknown> = { class: { schoolId } };
  if (classId) where.classId = classId;
  if (subjectId) where.subjectId = subjectId;
  if (term) where.term = term;
  if (sessionYear) where.session = sessionYear;

  const results = await prisma.result.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      subject: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ student: { lastName: "asc" } }, { subject: { name: "asc" } }],
  });

  return NextResponse.json({ results });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(resultSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { studentId, classId, subjectId, term, session: sessionYear, assignment, test, exam } = parsed.data;

    // Student must belong to this school.
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId, isActive: true },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const total = (assignment ?? 0) + (test ?? 0) + (exam ?? 0);
    const grade = calculateGrade(total);

    const result = await prisma.result.upsert({
      where: { studentId_subjectId_term_session: { studentId, subjectId, term, session: sessionYear } },
      update: {
        assignment: assignment ?? 0,
        test: test ?? 0,
        exam: exam ?? 0,
        total,
        grade,
        teacherId: session?.user?.teacherId ?? null,
      },
      create: {
        studentId,
        classId,
        subjectId,
        term,
        session: sessionYear,
        assignment: assignment ?? 0,
        test: test ?? 0,
        exam: exam ?? 0,
        total,
        grade,
        teacherId: session?.user?.teacherId ?? null,
      },
    });

    return NextResponse.json({ result, total, grade }, { status: 201 });
  } catch (error) {
    console.error("Failed to save result:", error);
    return NextResponse.json({ error: "Failed to save result" }, { status: 500 });
  }
}
