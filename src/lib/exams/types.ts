// ─── Phase 4: examination engine — shared types & defaults ───────────
import type { AssessmentKind } from "@prisma/client";

export interface EffectiveAssessmentConfig {
  assessmentTypeId: string;
  name: string;
  code: string | null;
  kind: AssessmentKind;
  /** percentage contribution toward the total (weights must sum to 100) */
  weight: number;
  /** raw maximum mark per entry */
  maxScore: number;
}

export interface GradeInfo {
  name: string;
  remark: string;
  gpa: number | null;
  isPass: boolean;
}

export interface ScoreBreakdownEntry {
  score: number;
  maxScore: number;
  weighted: number;
}

export interface ComputedSubjectResult {
  caScore: number;
  examScore: number;
  /** weighted total out of 100 */
  total: number;
  percentage: number;
  grade: GradeInfo;
  breakdown: Record<string, ScoreBreakdownEntry>;
  /** raw values for Phase 3 legacy columns */
  legacy: { assignment: number | null; test: number | null; exam: number | null };
}

/** Default Nigerian-style grading scale (spec: A=70-100 … F=below 40). */
export const DEFAULT_GRADE_BANDS = [
  { name: "A", minScore: 70, maxScore: 100, remark: "Excellent", gpa: 4.0, isPass: true, color: "text-green-600", sortOrder: 1 },
  { name: "B", minScore: 60, maxScore: 69, remark: "Very Good", gpa: 3.5, isPass: true, color: "text-green-600", sortOrder: 2 },
  { name: "C", minScore: 50, maxScore: 59, remark: "Good", gpa: 3.0, isPass: true, color: "text-yellow-600", sortOrder: 3 },
  { name: "D", minScore: 45, maxScore: 49, remark: "Fair", gpa: 2.5, isPass: true, color: "text-yellow-600", sortOrder: 4 },
  { name: "E", minScore: 40, maxScore: 44, remark: "Poor", gpa: 2.0, isPass: true, color: "text-orange-600", sortOrder: 5 },
  { name: "F", minScore: 0, maxScore: 39, remark: "Fail", gpa: 1.0, isPass: false, color: "text-red-600", sortOrder: 6 },
] as const;

/** Default assessment structure: Assignment 10% · Class Test 20% · Project 10% · Exam 60%. */
export const DEFAULT_ASSESSMENT_TYPES = [
  { name: "Assignment", code: "ASSIGNMENT", kind: "CA" as AssessmentKind, weight: 10, maxScore: 10, sortOrder: 1 },
  { name: "Class Test", code: "CLASS_TEST", kind: "CA" as AssessmentKind, weight: 20, maxScore: 20, sortOrder: 2 },
  { name: "Project", code: "PROJECT", kind: "CA" as AssessmentKind, weight: 10, maxScore: 10, sortOrder: 3 },
  { name: "Exam", code: "EXAM", kind: "EXAM" as AssessmentKind, weight: 60, maxScore: 60, sortOrder: 4 },
] as const;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Standard competition ranking ("1224"): equal totals share a position, next position skips. */
export function assignPositions(
  items: { id: string; total: number | null }[]
): Map<string, number> {
  const sorted = [...items].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const positions = new Map<string, number>();
  let rank = 0;
  let prevTotal: number | null = null;
  sorted.forEach((item, i) => {
    if (prevTotal === null || item.total !== prevTotal) rank = i + 1;
    positions.set(item.id, rank);
    prevTotal = item.total;
  });
  return positions;
}
