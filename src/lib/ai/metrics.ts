/**
 * EduFlow AI — student metrics + scoping (Phase 7).
 * Real, database-backed metrics used by the performance analyzer, risk
 * prediction, parent communication and report comment modules.
 */
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";

export type StudentMetrics = {
  overallAverage: number | null;
  subjectAverages: { subject: string; average: number | null; results: number }[];
  trend: { label: string; average: number | null }[];
  attendanceRate: number | null;
  homework: { assigned: number; submitted: number; rate: number | null };
  assignments: { assigned: number; submitted: number; rate: number | null };
  behaviourNotes: { event: string; note: string | null; date: string }[];
};

export async function getScopedStudent(opts: {
  studentId: string;
  schoolId: string;
  role: UserRole;
  teacherId?: string | null;
  parentId?: string | null;
  studentOwnId?: string | null;
}) {
  const base = { schoolId, isActive: true as const };
  if (opts.role === "STUDENT") {
    if (opts.studentOwnId !== opts.studentId) return null;
    return prisma.student.findFirst({ where: { ...base, id: opts.studentId }, include: { class: { select: { id: true, name: true } } } });
  }
  if (opts.role === "PARENT") {
    if (!opts.parentId) return null;
    return prisma.student.findFirst({ where: { ...base, id: opts.studentId, parentId: opts.parentId }, include: { class: { select: { id: true, name: true } } } });
  }
  // TEACHER / ADMIN / FINANCE: any active student in the school.
  return prisma.student.findFirst({ where: { ...base, id: opts.studentId }, include: { class: { select: { id: true, name: true } } } });
}

export async function computeStudentMetrics(studentId: string, schoolId: string): Promise<StudentMetrics> {
  const me = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  const [results, attendances, homeworkSubs, assignmentSubs, homeworkTotal, assignmentTotal, timeline] = await Promise.all([
    prisma.result.findMany({
      where: { studentId, status: { in: ["PUBLISHED", "LOCKED"] } },
      include: {
        subject: { select: { name: true } },
        academicTerm: { select: { name: true } },
        academicSession: { select: { name: true } },
      },
      orderBy: [{ academicSession: { name: "asc" } }, { academicTerm: { name: "asc" } }, { subject: { name: "asc" } }],
      take: 300,
    }),
    prisma.attendance.findMany({ where: { studentId }, select: { status: true }, take: 90 }),
    prisma.homeworkSubmission.count({ where: { studentId } }),
    prisma.assignmentSubmission.count({ where: { studentId } }),
    prisma.homework.count({ where: { schoolId, ...(me?.classId ? { classId: me.classId } : {}) } }),
    prisma.assignment.count({ where: { schoolId, ...(me?.classId ? { classId: me.classId } : {}) } }),
    prisma.studentTimeline.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { event: true, note: true, createdAt: true },
    }),
  ]);

  const totals = results.map((r) => Number(r.total ?? 0)).filter((n) => !Number.isNaN(n));
  const overallAverage = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null;

  const bySubject = new Map<string, { sum: number; count: number }>();
  for (const r of results) {
    const cur = bySubject.get(r.subject.name) ?? { sum: 0, count: 0 };
    const t = Number(r.total ?? 0);
    if (!Number.isNaN(t)) {
      cur.sum += t;
      cur.count += 1;
    }
    bySubject.set(r.subject.name, cur);
  }
  const subjectAverages = [...bySubject.entries()]
    .map(([subject, v]) => ({ subject, average: v.count ? Math.round((v.sum / v.count) * 10) / 10 : null, results: v.count }))
    .sort((a, b) => (a.average ?? 0) - (b.average ?? 0));

  const byBlock = new Map<string, { label: string; sum: number; count: number }>();
  for (const r of results) {
    const session = r.academicSession?.name ?? r.session;
    const term = r.academicTerm?.name ?? String(r.term);
    const label = `${session} · ${term}`;
    const cur = byBlock.get(label) ?? { label, sum: 0, count: 0 };
    const t = Number(r.total ?? 0);
    if (!Number.isNaN(t)) {
      cur.sum += t;
      cur.count += 1;
    }
    byBlock.set(label, cur);
  }
  const trend = [...byBlock.values()].map((b) => ({ label: b.label, average: b.count ? Math.round((b.sum / b.count) * 10) / 10 : null }));

  const total = attendances.length;
  const present = attendances.filter((a) => a.status === "PRESENT").length;
  const attendanceRate = total ? Math.round((present / total) * 100) : null;

  const hwRate = homeworkTotal ? Math.round((homeworkSubs / homeworkTotal) * 100) : null;
  const asRate = assignmentTotal ? Math.round((assignmentSubs / assignmentTotal) * 100) : null;

  return {
    overallAverage,
    subjectAverages,
    trend,
    attendanceRate,
    homework: { assigned: homeworkTotal, submitted: homeworkSubs, rate: hwRate },
    assignments: { assigned: assignmentTotal, submitted: assignmentSubs, rate: asRate },
    behaviourNotes: timeline.map((t) => ({ event: t.event, note: t.note, date: t.createdAt.toISOString() })),
  };
}

export function riskScoreFromMetrics(m: StudentMetrics): {
  riskScore: number;
  dropoutRisk: "LOW" | "MEDIUM" | "HIGH";
  failureRisk: "LOW" | "MEDIUM" | "HIGH";
} {
  const attendance = m.attendanceRate ?? 100;
  const academic = m.overallAverage ?? 50;
  const homeworkRate = m.homework.rate ?? 100;
  const behaviourPenalty = Math.min(m.behaviourNotes.length * 2, 20);
  const riskScore = Math.max(
    0,
    Math.min(100, Math.round(0.3 * (100 - attendance) + 0.4 * (100 - academic) + 0.2 * (100 - homeworkRate) + behaviourPenalty))
  );
  const dropoutRisk = riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";
  const failureRisk = academic < 50 ? "HIGH" : academic < 65 ? "MEDIUM" : "LOW";
  return { riskScore, dropoutRisk, failureRisk };
}
