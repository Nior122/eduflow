// ─── Phase 4: position & ranking engine ──────────────────────────────
import type { Result } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assignPositions, round2 } from "./types";

/**
 * Recompute subject + class positions for every student result in a
 * class x subject x term. Standard competition ranking with tie handling.
 */
export async function recomputePositions(opts: {
  schoolId: string;
  classId: string;
  subjectId: string;
  sessionId: string;
  termId: string;
}): Promise<number> {
  const results = await prisma.result.findMany({
    where: {
      classId: opts.classId,
      subjectId: opts.subjectId,
      academicSessionId: opts.sessionId,
      academicTermId: opts.termId,
      total: { not: null },
    },
    select: { id: true, total: true },
  });
  if (results.length === 0) return 0;

  const positions = assignPositions(
    results.map((r) => ({ id: r.id, total: Number(r.total ?? 0) }))
  );
  const totalStudents = results.length;

  await prisma.$transaction(
    results.map((r) =>
      prisma.result.update({
        where: { id: r.id },
        data: {
          subjectPosition: positions.get(r.id) ?? null,
          classPosition: positions.get(r.id) ?? null,
          totalStudents,
        },
      })
    )
  );
  return results.length;
}

export interface ClassStudentAverage {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  average: number;
  grade: string | null;
  passedSubjects: number;
  failedSubjects: number;
  subjectsTaken: number;
}

/**
 * Overall averages for every student in a class + term (used for class
 * positions, report cards, promotion lists).
 */
export async function getClassAverages(opts: {
  classId: string;
  sessionId: string;
  termId: string;
  statuses?: ("PUBLISHED" | "LOCKED")[];
}): Promise<ClassStudentAverage[]> {
  const results = await prisma.result.findMany({
    where: {
      classId: opts.classId,
      academicSessionId: opts.sessionId,
      academicTermId: opts.termId,
      status: opts.statuses ? { in: opts.statuses } : undefined,
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
        },
      },
    },
  });

  const byStudent = new Map<string, ClassStudentAverage>();
  for (const r of results) {
    const key = r.studentId;
    const entry = byStudent.get(key) ?? {
      studentId: key,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      admissionNumber: r.student.admissionNumber,
      average: 0,
      grade: null,
      passedSubjects: 0,
      failedSubjects: 0,
      subjectsTaken: 0,
    };
    entry.average += Number(r.percentage ?? r.total ?? 0);
    entry.subjectsTaken += 1;
    const passed = r.grade !== "F";
    if (passed) entry.passedSubjects += 1;
    else entry.failedSubjects += 1;
    byStudent.set(key, entry);
  }

  const list = [...byStudent.values()].map((e) => ({
    ...e,
    average: e.subjectsTaken > 0 ? round2(e.average / e.subjectsTaken) : 0,
  }));
  return list.sort((a, b) => b.average - a.average);
}

export function positionMap(
  averages: { studentId: string; average: number }[]
): Map<string, number> {
  return assignPositions(averages.map((a) => ({ id: a.studentId, total: a.average })));
}
