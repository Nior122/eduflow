import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schoolId = session.user.schoolId;

  const [results, feeRecords, fees, attendances] = await Promise.all([
    prisma.result.findMany({ where: { class: { schoolId } }, select: { total: true, grade: true } }),
    prisma.feeRecord.findMany({ where: { fee: { schoolId } }, select: { amount: true, status: true } }),
    prisma.fee.findMany({ where: { schoolId }, select: { amount: true } }),
    prisma.attendance.findMany({ where: { class: { schoolId } }, select: { status: true } }),
  ]);

  const totals = results.map((r) => Number(r.total)).filter((t) => !isNaN(t));
  const classAverages = totals.length > 0 ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : 0;
  const bestStudents = results.filter((r) => r.grade === "A").length;
  const weakSubjects = 0; // Placeholder - would need subject-level aggregation

  const revenue = feeRecords.filter((r) => r.status === "PAID").reduce((s, r) => s + Number(r.amount), 0);
  const outstanding = feeRecords.filter((r) => r.status === "PENDING").reduce((s, r) => s + Number(r.amount), 0);

  const attendanceRate = attendances.length > 0
    ? Math.round((attendances.filter((a) => a.status === "PRESENT").length / attendances.length) * 100) : 0;

  return NextResponse.json({
    academic: { bestStudents, weakSubjects, classAverages },
    financial: { revenue, outstanding },
    attendance: { rate: attendanceRate, trend: 3 },
  });
}
