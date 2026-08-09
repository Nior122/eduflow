import { prisma } from "./db";

/**
 * PHASE 6 — Shared portal helpers.
 */

/** Fetch a student only if they belong to the given parent + school. */
export async function getChildForParent(parentId: string, schoolId: string, childId: string) {
  return prisma.student.findFirst({
    where: { id: childId, parentId, schoolId, isActive: true },
    include: { class: { select: { id: true, name: true } } },
  });
}

/** Fetch a student only if they belong to the given school (student portal). */
export async function getStudentInSchool(schoolId: string, studentId: string) {
  return prisma.student.findFirst({
    where: { id: studentId, schoolId, isActive: true },
    include: { class: { select: { id: true, name: true } } },
  });
}

export function attendanceRate(rows: { status: string }[]): number {
  if (rows.length === 0) return 0;
  const present = rows.filter((r) => r.status === "PRESENT").length;
  return Math.round((present / rows.length) * 100);
}

export function averageScore(totals: (number | null)[]): number {
  const nums = totals.filter((t): t is number => t != null && !Number.isNaN(t));
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}
