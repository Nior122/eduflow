// ─── Phase 4: academic transcript builder ────────────────────────────
import { prisma } from "@/lib/db";
import { round2 } from "./types";

export interface TranscriptTermRow {
  sessionName: string;
  termName: string;
  className: string;
  overallAverage: number;
  overallGrade: string | null;
  classPosition: number | null;
  promotionStatus: string;
  isPublished: boolean;
  subjects: {
    subjectName: string;
    total: number;
    grade: string | null;
    remark: string | null;
  }[];
}

export interface TranscriptData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    gender: string | null;
    dateOfBirth: Date | null;
    admissionStatus: string;
    graduatedAt: Date | null;
  };
  schoolName: string;
  terms: TranscriptTermRow[];
  attendanceSummary: { present: number; total: number; rate: number };
  promotionHistory: { action: string; fromClass: string | null; toClass: string | null; session: string; note: string | null; date: Date }[];
  graduation: { certificateNumber: string | null; session: string; date: Date }[];
  generatedAt: Date;
}

/** Full academic history for one student (every session × term). */
export async function buildTranscript(studentId: string): Promise<TranscriptData | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { school: true },
  });
  if (!student) return null;

  const [reportCards, promotionRecords, graduationRecords, attendance] =
    await Promise.all([
      prisma.reportCard.findMany({
        where: { studentId },
        include: {
          session: true,
          term: true,
          class: true,
          student: false,
        },
        orderBy: [{ session: { name: "asc" } }, { term: { name: "asc" } }],
      }),
      prisma.promotionRecord.findMany({
        where: { studentId },
        include: { session: true, fromClass: true, toClass: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.graduationRecord.findMany({
        where: { studentId },
        include: { session: true },
        orderBy: { graduatedAt: "asc" },
      }),
      prisma.attendance.findMany({
        where: { studentId },
        select: { status: true },
      }),
    ]);

  const subjectMap = new Map<string, string>();
  const results = await prisma.result.findMany({
    where: { studentId },
    include: { subject: { select: { id: true, name: true } } },
  });
  for (const r of results) subjectMap.set(r.subjectId, r.subject.name);

  const terms: TranscriptTermRow[] = [];
  for (const rc of reportCards) {
    const termResults = results.filter(
      (r) => r.academicSessionId === rc.sessionId && r.academicTermId === rc.termId
    );
    terms.push({
      sessionName: rc.session.name,
      termName: rc.term.name,
      className: rc.class.name,
      overallAverage: Number(rc.overallAverage),
      overallGrade: rc.overallGrade,
      classPosition: rc.classPosition,
      promotionStatus: rc.promotionStatus,
      isPublished: rc.isPublished,
      subjects: termResults.map((r) => ({
        subjectName: r.subject.name,
        total: Number(r.percentage ?? r.total ?? 0),
        grade: r.grade,
        remark: r.remark,
      })),
    });
  }

  const present = attendance.filter((a) => ["PRESENT", "LATE"].includes(a.status)).length;

  await prisma.transcript.upsert({
    where: { studentId },
    update: { lastGeneratedAt: new Date() },
    create: { studentId },
  });

  return {
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      admissionNumber: student.admissionNumber,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      admissionStatus: student.admissionStatus,
      graduatedAt: student.graduatedAt,
    },
    schoolName: student.school.name,
    terms,
    attendanceSummary: {
      present,
      total: attendance.length,
      rate: attendance.length > 0 ? round2((present / attendance.length) * 100) : 100,
    },
    promotionHistory: promotionRecords.map((p) => ({
      action: p.action,
      fromClass: p.fromClass?.name ?? null,
      toClass: p.toClass?.name ?? null,
      session: p.session.name,
      note: p.note,
      date: p.createdAt,
    })),
    graduation: graduationRecords.map((g) => ({
      certificateNumber: g.certificateNumber,
      session: g.session.name,
      date: g.graduatedAt,
    })),
    generatedAt: new Date(),
  };
}
