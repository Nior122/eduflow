import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validate, timetableEntrySchema } from "@/lib/validations";

const STAFF_ROLES = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export async function GET(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const day = searchParams.get("day");
  const classId = searchParams.get("classId");
  const teacherId = searchParams.get("teacherId");
  const classroomId = searchParams.get("classroomId");

  const where: Record<string, unknown> = { schoolId };
  if (day) where.day = day;
  if (classId) where.classId = classId;
  if (teacherId) where.teacherId = teacherId;
  if (classroomId) where.classroomId = classroomId;

  const entries = await prisma.timetableEntry.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      classroom: { select: { id: true, name: true, roomNumber: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const session = await auth();
  const denied = requireRole(session, STAFF_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await parseJsonBody(req);
    const parsed = validate(timetableEntrySchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { day, startTime, endTime, classId, subjectId, teacherId, classroomId, sessionId, termId } = parsed.data;

    // Every referenced record must belong to this school.
    const [cls, subject] = await Promise.all([
      prisma.class.findFirst({ where: { id: classId, schoolId, isActive: true }, select: { id: true } }),
      prisma.subject.findFirst({ where: { id: subjectId, schoolId, isActive: true }, select: { id: true } }),
    ]);
    if (!cls || !subject) {
      return NextResponse.json({ error: "Class or subject not found" }, { status: 404 });
    }
    if (teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: { id: teacherId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    if (classroomId) {
      const room = await prisma.classroom.findFirst({
        where: { id: classroomId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!room) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
    }

    // Conflict prevention: no overlapping slot for the same class, teacher, or room.
    const or: Record<string, unknown>[] = [{ classId }];
    if (teacherId) or.push({ teacherId });
    if (classroomId) or.push({ classroomId });
    const sameDay = await prisma.timetableEntry.findMany({
      where: { schoolId, day, OR: or },
      select: { startTime: true, endTime: true, classId: true, teacherId: true, classroomId: true },
    });
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    const conflicts = sameDay.filter((c) => toMinutes(c.startTime) < end && start < toMinutes(c.endTime));
    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: "Scheduling conflict — this class, teacher, or room is already booked in that slot", conflicts },
        { status: 409 }
      );
    }

    const entry = await prisma.timetableEntry.create({
      data: {
        day,
        startTime,
        endTime,
        classId,
        subjectId,
        teacherId: teacherId ?? null,
        classroomId: classroomId ?? null,
        sessionId: sessionId ?? null,
        termId: termId ?? null,
        schoolId,
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Failed to create timetable entry:", error);
    return NextResponse.json({ error: "Failed to create timetable entry" }, { status: 500 });
  }
}
