import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ["TEACHER"], { schoolScoped: true });
  if (denied) return denied;
  const teacherId = session?.user?.teacherId;
  const schoolId = session?.user?.schoolId;
  if (!teacherId || !schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const classSubjects = await prisma.classSubject.findMany({
      where: { teacherId },
      include: { class: true, subject: true },
    });
    const classIds = classSubjects.map((cs) => cs.classId);

    const [studentsCount, todayAttendances] = await Promise.all([
      prisma.student.count({
        where: {
          schoolId,
          isActive: true,
          classId: { in: classIds },
        },
      }),
      prisma.attendance.findMany({
        where: {
          teacherId,
          date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        select: { status: true },
      }),
    ]);

    const classes = [...new Set(classSubjects.map((cs) => cs.class.name))];
    const subjects = [...new Set(classSubjects.map((cs) => cs.subject.name))];
    const present = todayAttendances.filter((a) => a.status === "PRESENT").length;
    const attendanceToday =
      todayAttendances.length > 0
        ? Math.round((present / todayAttendances.length) * 100)
        : 0;

    return NextResponse.json({
      students: studentsCount,
      classes: classes.length,
      subjects: subjects.length,
      attendanceToday,
    });
  } catch (error) {
    console.error("Failed to load teacher dashboard:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
