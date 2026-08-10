import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiComplete, parseJsonLoose, resolvePrompt } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import type { UserRole } from "@prisma/client";

const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "SUPER_ADMIN"];
const PUBLISHED = ["PUBLISHED", "LOCKED"] as const;

function weekKey(date: Date): string {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * POST /api/ai/analytics — AI School Analytics (Module 10).
 * Computes real aggregates (subject difficulty, teacher performance,
 * attendance/fee trends, at-risk students, class & department comparisons)
 * and writes a data-backed executive summary with the AI.
 */
export async function POST(req: Request) {
  const guard = await aiGuard({ module: "analytics", roles: ADMIN_ROLES });
  if (guard instanceof NextResponse) return guard;
  const { schoolId, userId } = guard;

  const body = await req.json().catch(() => null);
  const includeSummary = body?.includeSummary !== false;

  const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 86400000);
  const [results, attendances, payments, classSubjects, teachers, feeAgg, counts] = await Promise.all([
    prisma.result.findMany({
      where: { status: { in: [...PUBLISHED] }, student: { schoolId } },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true, classId: true, class: { select: { name: true } } } },
      },
      take: 5000,
    }),
    prisma.attendance.findMany({
      where: { student: { schoolId }, date: { gte: twelveWeeksAgo } },
      select: { studentId: true, date: true, status: true },
      take: 20000,
    }),
    prisma.payment.findMany({
      where: { schoolId, paidAt: { gte: twelveWeeksAgo } },
      select: { amount: true, paidAt: true },
      take: 5000,
    }),
    prisma.classSubject.findMany({
      where: { class: { schoolId } },
      select: { classId: true, subjectId: true, teacherId: true },
      take: 1000,
    }),
    prisma.teacher.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true, departmentId: true, department: { select: { name: true } } },
      take: 200,
    }),
    prisma.feeRecord.aggregate({
      where: { status: { notIn: ["PAID", "WAIVED"] }, student: { schoolId } },
      _sum: { amount: true },
    }),
    Promise.all([
      prisma.student.count({ where: { schoolId, isActive: true } }),
      prisma.teacher.count({ where: { schoolId, isActive: true } }),
      prisma.class.count({ where: { schoolId, isActive: true } }),
    ]),
  ]);

  // Subject performance (hardest first).
  const subjectMap = new Map<string, { sum: number; count: number }>();
  for (const r of results) {
    const cur = subjectMap.get(r.subject.name) ?? { sum: 0, count: 0 };
    cur.sum += Number(r.total ?? 0);
    cur.count += 1;
    subjectMap.set(r.subject.name, cur);
  }
  const subjectPerformance = [...subjectMap.entries()]
    .map(([subject, v]) => ({ subject, average: v.count ? round1(v.sum / v.count) : 0, results: v.count }))
    .sort((a, b) => a.average - b.average);

  // Class comparison.
  const classMap = new Map<string, { sum: number; count: number }>();
  for (const r of results) {
    const key = r.student.class?.name ?? "Unassigned";
    const cur = classMap.get(key) ?? { sum: 0, count: 0 };
    cur.sum += Number(r.total ?? 0);
    cur.count += 1;
    classMap.set(key, cur);
  }
  const classComparison = [...classMap.entries()]
    .map(([name, v]) => ({ name, average: v.count ? round1(v.sum / v.count) : 0, results: v.count }))
    .sort((a, b) => b.average - a.average);

  // Teacher performance via class-subject mapping.
  const csByKey = new Map<string, string | null>();
  for (const cs of classSubjects) csByKey.set(`${cs.classId}:${cs.subjectId}`, cs.teacherId);
  const teacherNames = new Map<string, string>();
  for (const t of teachers) teacherNames.set(t.id, `${t.firstName} ${t.lastName}`);
  const teacherMap = new Map<string, { sum: number; count: number }>();
  for (const r of results) {
    if (!r.student.classId) continue;
    const teacherId = csByKey.get(`${r.student.classId}:${r.subject.id}`) ?? null;
    if (!teacherId) continue;
    const key = teacherNames.get(teacherId) ?? "Unassigned";
    const cur = teacherMap.get(key) ?? { sum: 0, count: 0 };
    cur.sum += Number(r.total ?? 0);
    cur.count += 1;
    teacherMap.set(key, cur);
  }
  const teacherPerformance = [...teacherMap.entries()]
    .map(([name, v]) => ({ name, average: v.count ? round1(v.sum / v.count) : 0, results: v.count }))
    .sort((a, b) => b.average - a.average);

  // Department comparison.
  const deptByTeacher = new Map<string, string | null>();
  for (const t of teachers) deptByTeacher.set(t.id, t.department?.name ?? null);
  const deptMap = new Map<string, { sum: number; count: number }>();
  for (const r of results) {
    if (!r.student.classId) continue;
    const teacherId = csByKey.get(`${r.student.classId}:${r.subject.id}`) ?? null;
    const dept = teacherId ? (deptByTeacher.get(teacherId) ?? null) : null;
    const key = dept ?? "Unassigned";
    const cur = deptMap.get(key) ?? { sum: 0, count: 0 };
    cur.sum += Number(r.total ?? 0);
    cur.count += 1;
    deptMap.set(key, cur);
  }
  const departmentComparison = [...deptMap.entries()]
    .map(([name, v]) => ({ name, average: v.count ? round1(v.sum / v.count) : 0, results: v.count }))
    .sort((a, b) => b.average - a.average);

  // Weekly attendance trend.
  const attByWeek = new Map<string, { present: number; total: number }>();
  for (const a of attendances) {
    const key = weekKey(a.date);
    const cur = attByWeek.get(key) ?? { present: 0, total: 0 };
    cur.total += 1;
    if (a.status === "PRESENT") cur.present += 1;
    attByWeek.set(key, cur);
  }
  const attendanceTrend = [...attByWeek.entries()]
    .map(([week, v]) => ({ week, rate: v.total ? round1((v.present / v.total) * 100) : 0 }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Weekly fee collection trend.
  const feeByWeek = new Map<string, number>();
  for (const p of payments) {
    const key = weekKey(p.paidAt);
    feeByWeek.set(key, (feeByWeek.get(key) ?? 0) + Number(p.amount));
  }
  const feeTrend = [...feeByWeek.entries()]
    .map(([week, amount]) => ({ week, amount: round1(amount) }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // At-risk students (avg < 50 or attendance < 75).
  const studentAgg = new Map<string, { name: string; className: string | null; sum: number; count: number; present: number; attTotal: number }>();
  for (const r of results) {
    const cur = studentAgg.get(r.student.id) ?? {
      name: `${r.student.firstName} ${r.student.lastName}`,
      className: r.student.class?.name ?? null,
      sum: 0,
      count: 0,
      present: 0,
      attTotal: 0,
    };
    cur.sum += Number(r.total ?? 0);
    cur.count += 1;
    studentAgg.set(r.student.id, cur);
  }
  for (const a of attendances) {
    const cur = studentAgg.get(a.studentId);
    if (!cur) continue;
    cur.attTotal += 1;
    if (a.status === "PRESENT") cur.present += 1;
  }
  const atRisk = [...studentAgg.values()]
    .map((s) => ({
      name: s.name,
      className: s.className,
      average: s.count ? round1(s.sum / s.count) : null,
      attendanceRate: s.attTotal ? round1((s.present / s.attTotal) * 100) : null,
    }))
    .filter((s) => (s.average != null && s.average < 50) || (s.attendanceRate != null && s.attendanceRate < 75))
    .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
    .slice(0, 20);

  const metrics = {
    snapshot: {
      students: counts[0],
      teachers: counts[1],
      classes: counts[2],
      outstandingFees: Number(feeAgg._sum.amount ?? 0),
    },
    subjectPerformance,
    classComparison,
    teacherPerformance,
    departmentComparison,
    attendanceTrend,
    feeTrend,
    atRisk,
  };

  let summary: { headline: string; insights: string[]; recommendations: string[]; riskNote: string } | null = null;
  if (includeSummary) {
    const prompt = await resolvePrompt(schoolId, "analytics_summary", { metricsJson: JSON.stringify(metrics) });
    const result = await aiComplete({
      schoolId,
      userId,
      module: "analytics",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
    });
    const raw = (parseJsonLoose(result.text) ?? {}) as Record<string, unknown>;
    const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
    summary = {
      headline: typeof raw.headline === "string" ? raw.headline : "",
      insights: asList(raw.insights),
      recommendations: asList(raw.recommendations),
      riskNote: typeof raw.riskNote === "string" ? raw.riskNote : "",
    };
  }

  return NextResponse.json({ metrics, summary });
}
