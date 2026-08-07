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

  const [results, feeRecords, fees, attendances] = await Promise.all([
    prisma.result.findMany({
      where: { class: { schoolId } },
      select: {
        total: true,
        grade: true,
        subjectId: true,
        subject: { select: { name: true } },
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.feeRecord.findMany({
      where: { fee: { schoolId } },
      select: { amount: true, status: true, fee: { select: { amount: true } } },
    }),
    prisma.fee.findMany({ where: { schoolId, isActive: true }, select: { amount: true } }),
    prisma.attendance.findMany({
      where: { class: { schoolId } },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Academic
  const totals = results.map((r) => Number(r.total)).filter((t) => !isNaN(t));
  const classAverages =
    totals.length > 0 ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : 0;

  const bestStudents = [...results]
    .filter((r) => r.total != null && !isNaN(Number(r.total)))
    .sort((a, b) => Number(b.total) - Number(a.total))
    .slice(0, 5)
    .map((r) => ({
      name: `${r.student.firstName} ${r.student.lastName}`,
      score: Number(r.total),
      grade: r.grade ?? "—",
    }));

  // Real weak-subject aggregation: subjects with an average below 50.
  const bySubject = new Map<string, { name: string; sum: number; count: number }>();
  for (const r of results) {
    if (r.total == null || isNaN(Number(r.total))) continue;
    const t = Number(r.total);
    const entry = bySubject.get(r.subjectId) ?? { name: r.subject.name, sum: 0, count: 0 };
    entry.sum += t;
    entry.count += 1;
    bySubject.set(r.subjectId, entry);
  }
  const weakSubjects = [...bySubject.values()]
    .filter((s) => s.count > 0 && s.sum / s.count < 50)
    .map((s) => ({
      name: s.name,
      avg: Math.round((s.sum / s.count) * 10) / 10,
      results: s.count,
    }))
    .sort((a, b) => a.avg - b.avg);

  // Financial — real money numbers
  const revenue = feeRecords
    .filter((r) => r.status === "PAID" || r.status === "WAIVED")
    .reduce((s, r) => s + Number(r.amount), 0);
  const outstanding = feeRecords
    .filter((r) => r.status === "PENDING" || r.status === "PARTIAL")
    .reduce((s, r) => s + Math.max(0, Number(r.fee.amount) - Number(r.amount)), 0);
  const totalFees = fees.reduce((s, f) => s + Number(f.amount), 0);

  // Attendance — rate plus a real trend (recent half vs earlier half)
  const attendanceRate =
    attendances.length > 0
      ? Math.round((attendances.filter((a) => a.status === "PRESENT").length / attendances.length) * 100)
      : 0;
  const half = Math.floor(attendances.length / 2);
  const earlier = attendances.slice(half);
  const recent = attendances.slice(0, half);
  const rate = (rows: typeof attendances) =>
    rows.length > 0
      ? rows.filter((a) => a.status === "PRESENT").length / rows.length
      : null;
  const earlierRate = rate(earlier);
  const recentRate = rate(recent);
  const trend =
    earlierRate != null && recentRate != null ? Math.round((recentRate - earlierRate) * 100) : null;

  return NextResponse.json({
    academic: { bestStudents, weakSubjects, classAverages },
    financial: { revenue, outstanding, totalFees },
    attendance: { rate: attendanceRate, trend },
  });
}
