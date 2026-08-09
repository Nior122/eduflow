import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ["TEACHER"], { schoolScoped: true });
  if (denied) return denied;
  const teacherId = session?.user?.teacherId;
  const schoolId = session?.user?.schoolId;
  if (!teacherId || !schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const todayName = DAYS[now.getDay()];

    const classSubjects = await prisma.classSubject.findMany({
      where: { teacherId },
      include: { class: true, subject: true },
    });
    const classIds = classSubjects.map((cs) => cs.classId);

    const userId = session!.user!.id;
    const [studentsCount, todayAttendances, todayClasses, upcomingEvents, gradingQueue, pendingHomework, recentMessages, unreadNotifications] = await Promise.all([
      prisma.student.count({
        where: { schoolId, isActive: true, classId: { in: classIds } },
      }),
      prisma.attendance.findMany({
        where: { teacherId, date: { gte: startOfToday } },
        select: { status: true, classId: true },
      }),
      prisma.timetableEntry.findMany({
        where: { schoolId, teacherId, day: todayName },
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.calendarEvent.findMany({
        where: { schoolId, eventDate: { gte: startOfToday } },
        orderBy: { eventDate: "asc" },
        take: 5,
      }),
      prisma.assignmentSubmission.count({
        where: { assignment: { schoolId, teacherId }, grade: null },
      }),
      prisma.homeworkSubmission.count({
        where: { homework: { schoolId, teacherId }, grade: null },
      }),
      prisma.message.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }], isDraft: false },
        include: {
          sender: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    const classes = [...new Set(classSubjects.map((cs) => cs.class.name))];
    const subjects = [...new Set(classSubjects.map((cs) => cs.subject.name))];
    const present = todayAttendances.filter((a) => a.status === "PRESENT").length;
    const attendanceToday =
      todayAttendances.length > 0
        ? Math.round((present / todayAttendances.length) * 100)
        : 0;

    // Classes in today's timetable that still have no attendance recorded today.
    const attendedClassIds = new Set(todayAttendances.map((a) => a.classId));
    const pendingAttendance = todayClasses.filter((t) => !attendedClassIds.has(t.classId)).length;

    return NextResponse.json({
      students: studentsCount,
      classes: classes.length,
      subjects: subjects.length,
      attendanceToday,
      pendingAttendance,
      awaitingGrading: gradingQueue + pendingHomework,
      todayClasses: todayClasses.map((t) => ({
        id: t.id,
        startTime: t.startTime,
        endTime: t.endTime,
        subject: t.subject.name,
        className: t.class.name,
      })),
      upcomingEvents: upcomingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        eventDate: e.eventDate.toISOString(),
      })),
      unreadNotifications,
      recentMessages: recentMessages.map((m) => ({
        id: m.id,
        subject: m.subject,
        snippet: m.content.slice(0, 80),
        createdAt: m.createdAt.toISOString(),
        otherName: m.senderId === userId ? (m.receiver.name ?? "Unknown") : (m.sender.name ?? "Unknown"),
        incoming: m.senderId !== userId,
      })),
    });
  } catch (error) {
    console.error("Failed to load teacher dashboard:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
