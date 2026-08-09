import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStudentInSchool } from "@/lib/portal";

const STUDENT_ROLES = ["STUDENT"] as const;

/** GET /api/student/timetable — weekly timetable for the student's class. */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, STUDENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const studentId = session?.user?.studentId;
  const schoolId = session?.user?.schoolId;
  if (!studentId || !schoolId) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const me = await getStudentInSchool(schoolId, studentId);
  if (!me || !me.classId) {
    return NextResponse.json({ days: [] });
  }

  const entries = await prisma.timetableEntry.findMany({
    where: { schoolId, classId: me.classId },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });

  const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const days = DAYS.map((day) => ({
    day,
    entries: entries
      .filter((e) => e.day === day)
      .map((e) => ({
        id: e.id,
        startTime: e.startTime,
        endTime: e.endTime,
        subject: e.subject.name,
        teacher: e.teacher ? `${e.teacher.firstName} ${e.teacher.lastName}` : null,
      })),
  })).filter((d) => d.entries.length > 0);

  return NextResponse.json({ className: me.class?.name ?? null, days });
}
