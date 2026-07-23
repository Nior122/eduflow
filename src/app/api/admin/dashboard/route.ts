import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = session.user.schoolId;
  if (!schoolId) {
    return NextResponse.json({ error: "No school found" }, { status: 400 });
  }

  try {
    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      recentAttendances,
      feeRecords,
      feeTotal,
      results,
      recentActivities,
      notices,
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId, isActive: true } }),
      prisma.teacher.count({ where: { schoolId, isActive: true } }),
      prisma.class.count({ where: { schoolId } }),
      prisma.attendance.findMany({
        where: { class: { schoolId } },
        orderBy: { date: "desc" },
        take: 100,
      }),
      prisma.feeRecord.findMany({
        where: { fee: { schoolId } },
      }),
      prisma.fee.aggregate({
        where: { schoolId },
        _sum: { amount: true },
      }),
      prisma.result.findMany({
        where: { class: { schoolId } },
        take: 50,
      }),
      prisma.announcement.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.announcement.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);

    // Attendance rate
    const presentCount = recentAttendances.filter((a) => a.status === "PRESENT").length;
    const attendanceRate = recentAttendances.length > 0
      ? Math.round((presentCount / recentAttendances.length) * 100)
      : 0;

    // Fee collection rate
    const paidRecords = feeRecords.filter((r) => r.status === "PAID");
    const feeCollection = feeRecords.length > 0
      ? Math.round((paidRecords.length / feeRecords.length) * 100)
      : 0;

    // Average performance
    const totals = results.map((r) => Number(r.total)).filter((t) => !isNaN(t));
    const performanceAvg = totals.length > 0
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
      },
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.content.slice(0, 100),
        time: formatRelativeTime(a.createdAt),
        type: "announcement",
      })),
      notices: notices.map((n) => ({
        id: n.id,
        title: n.title,
        priority: n.priority,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
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
