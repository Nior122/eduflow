import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.teacherId || !session?.user?.schoolId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teacherId = session.user.teacherId;
  const schoolId = session.user.schoolId;

  try {
    const [classSubjects, studentsCount, todayAttendances] = await Promise.all([
      prisma.classSubject.findMany({
        where: { teacherId },
        include: { class: true, subject: true },
      }),
      prisma.student.count({
        where: {
          schoolId,
          classId: { in: (await prisma.classSubject.findMany({ where: { teacherId }, select: { classId: true } })).map(cs => cs.classId).filter(Boolean) },
          isActive: true,
        },
      }),
      prisma.attendance.findMany({
        where: {
          teacherId,
          date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    const classes = [...new Set(classSubjects.map((cs) => cs.class.name))];
    const subjects = [...new Set(classSubjects.map((cs) => cs.subject.name))];
    const present = todayAttendances.filter((a) => a.status === "PRESENT").length;
    const attendanceToday = todayAttendances.length > 0
      ? Math.round((present / todayAttendances.length) * 100) : 0;

    return NextResponse.json({
      students: studentsCount,
      classes: classes.length,
      subjects: subjects.length,
      attendanceToday,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
