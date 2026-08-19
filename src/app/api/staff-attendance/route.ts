import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, staffAttendanceSchema } from "@/lib/validations";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const teacherId = searchParams.get("teacherId");

  const where: Record<string, unknown> = { schoolId };
  if (date) where.date = new Date(date);
  if (teacherId) where.teacherId = teacherId;

  const records = await prisma.staffAttendance.findMany({
    where,
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true, staffId: true } },
    },
    orderBy: [{ date: "desc" }, { teacher: { firstName: "asc" } }],
    take: 500,
  });
  return NextResponse.json({ records });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(staffAttendanceSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { date, records } = parsed.data;

    const teacherIds = records.map((r) => r.teacherId);
    const validTeachers = await prisma.teacher.count({
      where: { id: { in: teacherIds }, schoolId, isActive: true },
    });
    if (validTeachers !== teacherIds.length) {
      return NextResponse.json({ error: "One or more teachers are not valid for this school" }, { status: 400 });
    }

    const attendanceDate = new Date(date);
    const saved = await prisma.$transaction(async (tx) => {
      await tx.staffAttendance.deleteMany({
        where: { date: attendanceDate, schoolId, teacherId: { in: teacherIds } },
      });
      return tx.staffAttendance.createMany({
        data: records.map((r) => ({
          date: attendanceDate,
          teacherId: r.teacherId,
          status: r.status,
          schoolId,
          markedById: session?.user?.id ?? null,
        })),
      });
    });

    return NextResponse.json({ count: saved.count }, { status: 201 });
  } catch (error) {
    console.error("Failed to save staff attendance:", error);
    return NextResponse.json({ error: "Failed to save staff attendance" }, { status: 500 });
  }
}
