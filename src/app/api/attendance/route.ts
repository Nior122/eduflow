import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, attendanceSchema } from "@/lib/validations";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const date = searchParams.get("date");
  const subjectId = searchParams.get("subjectId");

  const where: Record<string, unknown> = { class: { schoolId } };
  if (classId) where.classId = classId;
  if (date) where.date = new Date(date);
  if (subjectId === "all" || subjectId === "null") {
    where.subjectId = null;
  } else if (subjectId) {
    where.subjectId = subjectId;
  }

  const attendances = await prisma.attendance.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });

  return NextResponse.json({ attendances });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = validate(attendanceSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { classId, date, subjectId, records } = parsed.data;

    // Class must belong to this school, and only its students may be saved.
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId, isActive: true },
      select: { id: true, students: { select: { id: true } } },
    });
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const validIds = new Set(cls.students.map((s) => s.id));
    const validRecords = records.filter((r) => validIds.has(r.studentId));
    if (validRecords.length === 0) {
      return NextResponse.json({ error: "No valid student records to save" }, { status: 400 });
    }

    const attendanceDate = new Date(date);

    // Delete existing records for this exact scope (explicit null for
    // whole-class saves — never wipes subject-scoped records) and insert
    // the new ones atomically.
    const saved = await prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({
        where: { classId, date: attendanceDate, subjectId: subjectId ?? null },
      });
      return tx.attendance.createMany({
        data: validRecords.map((r) => ({
          studentId: r.studentId,
          classId,
          date: attendanceDate,
          subjectId: subjectId ?? null,
          teacherId: session?.user?.teacherId ?? null,
          status: r.status,
        })),
      });
    });

    return NextResponse.json({ count: saved.count }, { status: 201 });
  } catch (error) {
    console.error("Failed to save attendance:", error);
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 });
  }
}
