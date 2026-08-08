// ─── Phase 4: score aggregation engine ───────────────────────────────
// Weighted assessment model:
//   contribution = (raw score / maxScore) * weight
//   total        = sum of contributions (out of 100 when weights sum to 100)
import { prisma } from "@/lib/db";
import { applyGrade, getGradeBands } from "./grades";
import {
  round2,
  type ComputedSubjectResult,
  type EffectiveAssessmentConfig,
} from "./types";

/** Effective per-term assessment config (school defaults + term overrides). */
export async function getEffectiveConfigs(opts: {
  schoolId: string;
  termId: string;
}): Promise<EffectiveAssessmentConfig[]> {
  const [types, configs] = await Promise.all([
    prisma.assessmentType.findMany({
      where: { schoolId: opts.schoolId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.termAssessmentConfig.findMany({ where: { termId: opts.termId } }),
  ]);
  const overrides = new Map(
    configs.map((c) => [c.assessmentTypeId, c] as const)
  );
  return types.map((t) => {
    const o = overrides.get(t.id);
    return {
      assessmentTypeId: t.id,
      name: t.name,
      code: t.code,
      kind: t.kind,
      weight: o?.weight ?? t.weight,
      maxScore: o?.maxScore ?? t.maxScore,
    };
  });
}

interface RawScoreInput {
  score: number;
  maxScore: number;
  assessmentTypeId: string;
  assessmentTypeName: string;
  code: string | null;
  kind: "CA" | "EXAM";
  weight: number;
}

export function computeSubjectResult(
  rawScores: RawScoreInput[],
  bands: Awaited<ReturnType<typeof getGradeBands>>
): ComputedSubjectResult {
  const breakdown: Record<string, { score: number; maxScore: number; weighted: number }> = {};
  let caScore = 0;
  let examScore = 0;
  let assignment: number | null = null;
  let test: number | null = null;
  let exam: number | null = null;

  for (const s of rawScores) {
    const weighted = s.maxScore > 0 ? (s.score / s.maxScore) * s.weight : 0;
    breakdown[s.assessmentTypeName] = {
      score: s.score,
      maxScore: s.maxScore,
      weighted: round2(weighted),
    };
    if (s.kind === "CA") {
      caScore += weighted;
    } else {
      examScore += weighted;
    }
    if (s.code === "ASSIGNMENT") assignment = s.score;
    if (s.code === "CLASS_TEST") test = s.score;
    if (s.code === "EXAM") exam = s.score;
  }

  const total = round2(caScore + examScore);
  const grade = applyGrade(total, bands);
  return {
    caScore: round2(caScore),
    examScore: round2(examScore),
    total,
    percentage: total,
    grade,
    breakdown,
    legacy: { assignment, test, exam },
  };
}

/** Load raw scores for one student x subject x term and compute the result. */
export async function computeSubjectResultForStudent(opts: {
  schoolId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  sessionId: string;
  termId: string;
}) {
  const [configs, bands, scores] = await Promise.all([
    getEffectiveConfigs({ schoolId: opts.schoolId, termId: opts.termId }),
    getGradeBands(opts.schoolId),
    prisma.assessmentScore.findMany({
      where: {
        studentId: opts.studentId,
        subjectId: opts.subjectId,
        sessionId: opts.sessionId,
        termId: opts.termId,
      },
      include: { assessmentType: true },
    }),
  ]);

  const byType = new Map(scores.map((s) => [s.assessmentTypeId, s]));
  const raw = configs
    .filter((c) => byType.has(c.assessmentTypeId))
    .map((c) => {
      const s = byType.get(c.assessmentTypeId)!;
      return {
        score: Number(s.score),
        maxScore: s.maxScore,
        assessmentTypeId: c.assessmentTypeId,
        assessmentTypeName: c.name,
        code: c.code,
        kind: c.kind,
        weight: c.weight,
      };
    });

  if (raw.length === 0) return null;
  return computeSubjectResult(raw, bands);
}

/**
 * Upsert a computed Result row (legacy unique key preserved so Phase 3
 * read/write paths stay consistent: term = enum, session = session name).
 */
export async function upsertComputedResult(opts: {
  schoolId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  sessionId: string;
  termId: string;
  termName: "FIRST" | "SECOND" | "THIRD";
  sessionName: string;
  teacherId?: string | null;
}) {
  const computed = await computeSubjectResultForStudent(opts);
  if (!computed) return null;

  const data = {
    total: computed.total,
    percentage: computed.percentage,
    caScore: computed.caScore,
    examScore: computed.examScore,
    grade: computed.grade.name,
    remark: computed.grade.remark,
    assignment: computed.legacy.assignment,
    test: computed.legacy.test,
    exam: computed.legacy.exam,
    teacherId: opts.teacherId ?? undefined,
    academicSessionId: opts.sessionId,
    academicTermId: opts.termId,
  };

  return prisma.result.upsert({
    where: {
      studentId_subjectId_term_session: {
        studentId: opts.studentId,
        subjectId: opts.subjectId,
        term: opts.termName,
        session: opts.sessionName,
      },
    },
    update: data,
    create: {
      ...data,
      studentId: opts.studentId,
      subjectId: opts.subjectId,
      classId: opts.classId,
      term: opts.termName,
      session: opts.sessionName,
    },
  });
}
