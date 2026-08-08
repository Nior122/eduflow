// ─── Phase 4: grade engine ───────────────────────────────────────────
import type { GradeBand } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_GRADE_BANDS, type GradeInfo } from "./types";

/** School-configured bands; falls back to the default scale when unset. */
export async function getGradeBands(schoolId: string): Promise<GradeBand[]> {
  const bands = await prisma.gradeBand.findMany({
    where: { schoolId },
    orderBy: { sortOrder: "asc" },
  });
  if (bands.length > 0) return bands;
  return DEFAULT_GRADE_BANDS as unknown as GradeBand[];
}

/** Map a 0-100 percentage onto the configured grading scale. */
export function applyGrade(percentage: number, bands: GradeBand[]): GradeInfo {
  // Bands are [minScore, nextMinScore): pick the highest minScore that the
  // percentage reaches. Handles decimal totals (e.g. 69.4 -> B for 60-69).
  const sorted = [...bands].sort((a, b) => b.minScore - a.minScore);
  const selected = sorted.find((b) => percentage >= b.minScore) ?? bands[bands.length - 1];
  return {
    name: selected.name,
    remark: selected.remark,
    gpa: selected.gpa != null ? Number(selected.gpa) : null,
    isPass: selected.isPass,
  };
}

export function gradeColor(grade: string | null | undefined): string {
  switch (grade) {
    case "A":
    case "B":
      return "text-green-600";
    case "C":
    case "D":
      return "text-yellow-600";
    case "E":
      return "text-orange-600";
    case "F":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

export function gradeBadgeVariant(grade: string | null | undefined): "success" | "warning" | "destructive" | "secondary" {
  switch (grade) {
    case "A":
    case "B":
      return "success";
    case "C":
    case "D":
    case "E":
      return "warning";
    case "F":
      return "destructive";
    default:
      return "secondary";
  }
}
