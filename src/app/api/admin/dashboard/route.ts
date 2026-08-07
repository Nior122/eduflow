import { NextResponse } from "next/server";
import { auth, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"] as const;

export async function GET() {
  const session = await auth();
  const denied = requireRole(session, ADMIN_ROLES, { schoolScoped: true });
  if (denied) return denied;
  const schoolId = session?.user?.schoolId;
  if (!schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevWindowStart = new Date(monthAgo.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      studentsRecent,
      studentsPrev,
      teachersRecent,
      teachersPrev,
      recentAttendances,
      feeRecords,
      feeTotal,
      results,
      recentActivities,
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId, isActive: true } }),
      prisma.teacher.count({ where: { schoolId, isActive: true } }),
      prisma.class.count({ where: { schoolId, isActive: true } }),
      prisma.student.count({ where: { schoolId, isActive: true, createdAt: { gte: monthAgo } } }),
      prisma.student.count({
        where: { schoolId, isActive: true, createdAt: { gte: prevWindowStart, lt: monthAgo } },
      }),
      prisma.teacher.count({ where: { schoolId, isActive: true, createdAt: { gte: monthAgo } } }),
      prisma.teacher.count({
        where: { schoolId, isActive: true, createdAt: { gte: prevWindowStart, lt: monthAgo } },
      }),
      prisma.attendance.findMany({
        where: { class: { schoolId } },
        orderBy: { date: "desc" },
        take: 100,
      }),
      prisma.feeRecord.findMany({
        where: { fee: { schoolId } },
        select: { amount: true, status: true },
      }),
      prisma.fee.aggregate({
        where: { schoolId, isActive: true },
        _sum: { amount: true },
      }),
      prisma.result.findMany({
        where: { class: { schoolId } },
        take: 50,
        select: { total: true },
      }),
      prisma.announcement.findMany({
        where: { schoolId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, content: true, createdAt: true },
      }),
    ]);

    // Attendance rate (last 100 records)
    const presentCount = recentAttendances.filter((a) => a.status === "PRESENT").length;
    const attendanceRate =
      recentAttendances.length > 0
        ? Math.round((presentCount / recentAttendances.length) * 100)
        : 0;

    // Fee collection rate — real money ratio (paid sum / expected sum)
    const paidSum = feeRecords
      .filter((r) => r.status === "PAID" || r.status === "WAIVED")
      .reduce((s, r) => s + Number(r.amount), 0);
    const expectedSum = feeRecords.reduce((s, r) => s + Number(r.amount), 0);
    const feeCollection =
      expectedSum > 0 ? Math.round((paidSum / expectedSum) * 100) : 0;

    // Average performance
    const totals = results.map((r) => Number(r.total)).filter((t) => !isNaN(t));
    const performanceAvg =
      totals.length > 0
        ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10
        : 0;

    return NextResponse.json({
      stats: {
        totalStudents,
        totalTeachers,
        totalClasses,
        attendanceRate,
        feeCollection,
        performanceAvg,
        studentTrend: trendOf(studentsPrev, studentsRecent),
        teacherTrend: trendOf(teachersPrev, teachersRecent),
      },
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.content.slice(0, 100),
        time: formatRelativeTime(a.createdAt),
        type: "announcement",
      })),
      feeTotal: Number(feeTotal._sum.amount ?? 0),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}

/** Percent change vs the previous window; null when there is no baseline. */
function trendOf(prev: number, recent: number): number | null {
  if (prev <= 0) return recent > 0 ? 100 : null;
  return Math.round(((recent - prev) / prev) * 100);
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
