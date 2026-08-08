// ─── Phase 4: performance analytics engine ───────────────────────────
import { prisma } from "@/lib/db";
import { round2 } from "./types";

export interface SubjectStat {
  subjectId: string;
  subjectName: string;
  average: number;
  passRate: number;
  failRate: number;
  max: number;
  min: number;
  students: number;
}

export interface GradeDistribution {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
}

export interface ClassAnalytics {
  className: string;
  studentCount: number;
  overallAverage: number;
  passRate: number;
  failRate: number;
  bestSubject: SubjectStat | null;
  weakestSubject: SubjectStat | null;
  subjects: SubjectStat[];
  distribution: GradeDistribution;
}

function distributionOf(results: { grade: string | null }[]): GradeDistribution {
  const dist: GradeDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  for (const r of results) {
    const g = (r.grade ?? "F") as string;
    if (g in dist) dist[g as keyof GradeDistribution] += 1;
    else dist.F += 1;
  }
  return dist;
}

export async function getClassAnalytics(opts: {
  classId: string;
  sessionId: string;
  termId: string;
}): Promise<ClassAnalytics | null> {
  const [cls, results] = await Promise.all([
    prisma.class.findUnique({
      where: { id: opts.classId },
      include: { students: { where: { isActive: true }, select: { id: true } } },
    }),
    prisma.result.findMany({
      where: {
        classId: opts.classId,
        academicSessionId: opts.sessionId,
        academicTermId: opts.termId,
        status: { in: ["PUBLISHED", "LOCKED"] },
      },
      include: { subject: { select: { id: true, name: true } } },
    }),
  ]);
  if (!cls) return null;

  const bySubject = new Map<string, { id: string; name: string; totals: number[]; grades: string[] }>();
  for (const r of results) {
    const entry = bySubject.get(r.subjectId) ?? { id: r.subjectId, name: r.subject.name, totals: [], grades: [] };
    entry.totals.push(Number(r.percentage ?? r.total ?? 0));
    entry.grades.push(r.grade ?? "F");
    bySubject.set(r.subjectId, entry);
  }

  const subjects: SubjectStat[] = [...bySubject.values()].map((s) => {
    const average = s.totals.length ? s.totals.reduce((a, b) => a + b, 0) / s.totals.length : 0;
    const passCount = s.totals.filter((t) => t >= 50).length;
    return {
      subjectId: s.id,
      subjectName: s.name,
      average: round2(average),
      passRate: s.totals.length ? round2((passCount / s.totals.length) * 100) : 0,
      failRate: s.totals.length ? round2(((s.totals.length - passCount) / s.totals.length) * 100) : 0,
      max: s.totals.length ? Math.max(...s.totals) : 0,
      min: s.totals.length ? Math.min(...s.totals) : 0,
      students: s.totals.length,
    };
  }).sort((a, b) => b.average - a.average);

  const byStudent = new Map<string, number[]>();
  for (const r of results) {
    const arr = byStudent.get(r.studentId) ?? [];
    arr.push(Number(r.percentage ?? r.total ?? 0));
    byStudent.set(r.studentId, arr);
  }
  const studentAverages = [...byStudent.values()].map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
  const overallAverage = studentAverages.length
    ? round2(studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length)
    : 0;
  const passCount = studentAverages.filter((a) => a >= 50).length;

  return {
    className: cls.name,
    studentCount: cls.students.length,
    overallAverage,
    passRate: studentAverages.length ? round2((passCount / studentAverages.length) * 100) : 0,
    failRate: studentAverages.length ? round2(((studentAverages.length - passCount) / studentAverages.length) * 100) : 0,
    bestSubject: subjects[0] ?? null,
    weakestSubject: subjects[subjects.length - 1] ?? null,
    subjects,
    distribution: distributionOf(results),
  };
}

export interface TrendPoint {
  sessionName: string;
  termName: string;
  sessionId: string;
  termId: string;
  overallAverage: number;
  passRate: number;
  students: number;
}

/** Term-by-term averages for a class (performance trend). */
export async function getClassTrend(opts: { classId: string }): Promise<TrendPoint[]> {
  const reportCards = await prisma.reportCard.findMany({
    where: { classId: opts.classId, isPublished: true },
    include: { session: true, term: true },
    orderBy: [{ session: { name: "asc" } }, { term: { name: "asc" } }],
  });
  const byKey = new Map<string, { sum: number; count: number; pass: number }>();
  for (const rc of reportCards) {
    const key = rc.sessionId + ":" + rc.termId;
    const entry = byKey.get(key) ?? { sum: 0, count: 0, pass: 0 };
    entry.sum += Number(rc.overallAverage);
    entry.count += 1;
    if (Number(rc.overallAverage) >= 50) entry.pass += 1;
    byKey.set(key, entry);
  }
  const seen = new Set<string>();
  return reportCards
    .filter((rc) => {
      const key = rc.sessionId + ":" + rc.termId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((rc) => {
      const key = rc.sessionId + ":" + rc.termId;
      const e = byKey.get(key)!;
      return {
        sessionName: rc.session.name,
        termName: rc.term.name,
        sessionId: rc.sessionId,
        termId: rc.termId,
        overallAverage: round2(e.sum / e.count),
        passRate: round2((e.pass / e.count) * 100),
        students: e.count,
      };
    });
}

/** School-wide summary across a term. */
export async function getSchoolAnalytics(opts: { schoolId: string; sessionId: string; termId: string }) {
  const [classes, subjectStats] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: opts.schoolId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.result.findMany({
      where: {
        class: { schoolId: opts.schoolId },
        academicSessionId: opts.sessionId,
        academicTermId: opts.termId,
        status: { in: ["PUBLISHED", "LOCKED"] },
      },
      include: { subject: { select: { name: true } } },
    }),
  ]);

  const perSubject = new Map<string, number[]>();
  for (const r of subjectStats) {
    const arr = perSubject.get(r.subject.name) ?? [];
    arr.push(Number(r.percentage ?? r.total ?? 0));
    perSubject.set(r.subject.name, arr);
  }
  const ranked = [...perSubject.entries()]
    .map(([name, arr]) => ({
      subjectName: name,
      average: round2(arr.reduce((a, b) => a + b, 0) / arr.length),
      students: arr.length,
    }))
    .sort((a, b) => b.average - a.average);

  const classSummaries = (
    await Promise.all(
      classes.map(async (c) => {
        const a = await getClassAnalytics({ classId: c.id, sessionId: opts.sessionId, termId: opts.termId });
        return a
          ? { classId: c.id, className: c.name, overallAverage: a.overallAverage, passRate: a.passRate }
          : null;
      })
    )
  ).filter((x): x is { classId: string; className: string; overallAverage: number; passRate: number } => x !== null);

  return {
    classes: classSummaries,
    topSubjects: ranked.slice(0, 5),
    weakSubjects: ranked.slice(-5).reverse(),
    subjectComparison: ranked,
    totalResults: subjectStats.length,
  };
}
