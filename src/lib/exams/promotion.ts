// ─── Phase 4: promotion & graduation engine ──────────────────────────
import type { PromotionAction } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getClassAverages } from "./positions";

export interface PromotionCandidate {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  average: number;
  passedSubjects: number;
  failedSubjects: number;
  subjectsTaken: number;
  suggestedAction: "PROMOTED" | "REPEATED";
  suggestedClassId: string | null;
  suggestedClassName: string | null;
}

/**
 * Promotion suggestion list for a class + term based on published results:
 * PROMOTED when overall average >= 50 with no failing subject, else REPEATED.
 */
export async function getPromotionCandidates(opts: {
  schoolId: string;
  classId: string;
  sessionId: string;
  termId: string;
}): Promise<PromotionCandidate[]> {
  const [averages, nextClasses] = await Promise.all([
    getClassAverages({
      classId: opts.classId,
      sessionId: opts.sessionId,
      termId: opts.termId,
      statuses: ["PUBLISHED", "LOCKED"],
    }),
    prisma.class.findMany({
      where: { schoolId: opts.schoolId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true },
    }),
  ]);

  const current = await prisma.class.findUnique({ where: { id: opts.classId } });
  const ordered = nextClasses
    .filter((c) => current && c.category === current.category)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const idx = ordered.findIndex((c) => c.id === opts.classId);
  const nextClass = idx >= 0 ? ordered[idx + 1] ?? null : null;

  return averages.map((a) => ({
    studentId: a.studentId,
    studentName: a.studentName,
    admissionNumber: a.admissionNumber,
    average: a.average,
    passedSubjects: a.passedSubjects,
    failedSubjects: a.failedSubjects,
    subjectsTaken: a.subjectsTaken,
    suggestedAction: (a.average >= 50 && a.failedSubjects === 0 ? "PROMOTED" : "REPEATED") as "PROMOTED" | "REPEATED",
    suggestedClassId: nextClass?.id ?? null,
    suggestedClassName: nextClass?.name ?? null,
  }));
}

export interface ApplyPromotionInput {
  studentId: string;
  action: PromotionAction;
  fromClassId: string;
  toClassId: string | null;
  sessionId: string;
  byUserId: string;
  note?: string | null;
}

/** Apply a promotion / repeat / transfer / archive action in one transaction. */
export async function applyPromotion(input: ApplyPromotionInput) {
  const { studentId, action, fromClassId, toClassId, sessionId, byUserId, note } = input;

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new Error("Student not found");

    const data: Record<string, unknown> = { admissionStatus: "ACTIVE" };
    if (action === "PROMOTED" || action === "TRANSFERRED") {
      if (!toClassId) throw new Error("Target class is required");
      data.classId = toClassId;
      data.promotedAt = new Date();
    }
    if (action === "GRADUATED") {
      data.admissionStatus = "GRADUATED";
      data.graduatedAt = new Date();
      if (toClassId) data.classId = toClassId;
    }
    if (action === "ARCHIVED") {
      data.admissionStatus = "ARCHIVED";
      data.isActive = false;
    }
    if (action === "REPEATED") {
      data.classId = fromClassId; // stays in same class
      data.promotedAt = null;
    }
    await tx.student.update({ where: { id: studentId }, data });

    const record = await tx.promotionRecord.create({
      data: {
        studentId,
        action,
        fromClassId,
        toClassId: action === "REPEATED" ? fromClassId : toClassId,
        sessionId,
        byUserId,
        note: note ?? null,
      },
    });

    if (action === "GRADUATED") {
      const certNo = `G-${student.admissionNumber}-${new Date().getFullYear()}`;
      await tx.graduationRecord.upsert({
        where: { studentId_sessionId: { studentId, sessionId } },
        update: { note: note ?? null },
        create: {
          studentId,
          sessionId,
          byUserId,
          certificateNumber: certNo,
          note: note ?? null,
        },
      });
    }

    await tx.studentTimeline.create({
      data: {
        studentId,
        event: `Student ${action.toLowerCase()} (${record.id.slice(0, 6)})`,
        note: note ?? undefined,
      },
    });

    return record;
  });
}
