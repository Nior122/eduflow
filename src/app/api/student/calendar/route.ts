import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STUDENT_ROLES = ["STUDENT"] as const;

/** GET /api/student/calendar — upcoming school/class events + exams for the student. */
export async function GET() {
  const session = await auth();
  const denied = requireRole(session, STUDENT_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const studentId = session?.user?.studentId;
  const schoolId = session?.user?.schoolId;
  if (!studentId || !schoolId) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const me = await prisma.student.findUnique({
    where: { id: studentId },
    select: { classId: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [events, exams] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        schoolId,
        eventDate: { gte: today },
        ...(me?.classId ? { OR: [{ classId: null }, { classId: me.classId }] } : {}),
      },
      orderBy: { eventDate: "asc" },
      take: 20,
    }),
    prisma.examination.findMany({
      where: {
        schoolId,
        status: "ACTIVE",
        endDate: { gte: today },
        ...(me?.classId ? { classes: { some: { classId: me.classId } } } : {}),
      },
      include: {
        session: { select: { name: true } },
        term: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      type: e.type,
      eventDate: e.eventDate.toISOString(),
      startTime: e.startTime,
      endTime: e.endTime,
    })),
    exams: exams.map((x) => ({
      id: x.id,
      name: x.name,
      type: x.type,
      startDate: x.startDate?.toISOString() ?? null,
      endDate: x.endDate?.toISOString() ?? null,
      sessionName: x.session.name,
      termName: x.term.name,
    })),
  });
}
