// ─── Phase 4: report card generator ──────────────────────────────────
import type { PromotionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getGradeBands, applyGrade } from "./grades";
import { getClassAverages, positionMap } from "./positions";
import { round2 } from "./types";

export interface ReportCardData {
  reportCardId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    profileImage: string | null;
    gender: string | null;
  };
  school: {
    name: string;
    motto: string | null;
    logo: string | null;
    address: string | null;
    principal: string | null;
  };
  sessionName: string;
  termName: string;
  className: string;
  attendance: { present: number; absent: number; late: number; excused: number; total: number; rate: number };
  results: {
    subjectId: string;
    subjectName: string;
    caScore: number;
    examScore: number;
    total: number;
    grade: string;
    remark: string;
    subjectPosition: number | null;
    totalStudents: number | null;
  }[];
  overallAverage: number;
  overallGrade: string;
  classPosition: number | null;
  totalStudents: number | null;
  promotionStatus: PromotionStatus;
  classTeacherComment: string | null;
  principalComment: string | null;
  verificationCode: string;
  isPublished: boolean;
  publishedAt: Date | null;
}

/** Build (and persist) the report card for one student + term. */
export async function buildReportCard(opts: {
  studentId: string;
  sessionId: string;
  termId: string;
  generatedById?: string | null;
  forceRegenerate?: boolean;
}): Promise<ReportCardData | null> {
  const student = await prisma.student.findUnique({
    where: { id: opts.studentId },
    include: { school: true, class: true },
  });
  if (!student || !student.classId) return null;

  const [session, term] = await Promise.all([
    prisma.academicSession.findUnique({ where: { id: opts.sessionId } }),
    prisma.academicTerm.findUnique({ where: { id: opts.termId } }),
  ]);
  if (!session || !term) return null;

  const [results, attendance] = await Promise.all([
    prisma.result.findMany({
      where: {
        studentId: opts.studentId,
        academicSessionId: opts.sessionId,
        academicTermId: opts.termId,
        status: { in: ["PUBLISHED", "LOCKED"] },
      },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { subject: { name: "asc" } },
    }),
    prisma.attendance.findMany({
      where: {
        studentId: opts.studentId,
        date: {
          gte: term.startDate ?? undefined,
          lte: term.endDate ?? undefined,
        },
      },
    }),
  ]);

  const bands = await getGradeBands(student.schoolId);

  const mappedResults = results.map((r) => ({
    subjectId: r.subjectId,
    subjectName: r.subject.name,
    caScore: Number(r.caScore ?? 0),
    examScore: Number(r.examScore ?? 0),
    total: Number(r.percentage ?? r.total ?? 0),
    grade: r.grade ?? "—",
    remark: r.remark ?? "",
    subjectPosition: r.subjectPosition,
    totalStudents: r.totalStudents,
  }));

  const overallAverage =
    mappedResults.length > 0
      ? round2(mappedResults.reduce((s, r) => s + r.total, 0) / mappedResults.length)
      : 0;
  const overallGrade = applyGrade(overallAverage, bands).name;

  const present = attendance.filter((a) => ["PRESENT", "LATE"].includes(a.status)).length;
  const absent = attendance.filter((a) => a.status === "ABSENT").length;
  const late = attendance.filter((a) => a.status === "LATE").length;
  const excused = attendance.filter((a) => a.status === "EXCUSED").length;

  const classAverages = await getClassAverages({
    classId: student.classId,
    sessionId: opts.sessionId,
    termId: opts.termId,
    statuses: ["PUBLISHED", "LOCKED"],
  });
  const positions = positionMap(classAverages);
  const classPosition = positions.get(opts.studentId) ?? null;
  const totalStudents = classAverages.length;

  // Promotion suggestion: pass (>= 50 average, no failing subject) when
  // results are published; report cards stay PENDING until admin decides.
  const suggested: PromotionStatus =
    mappedResults.length > 0 &&
    overallAverage >= 50 &&
    !mappedResults.some((r) => r.grade === "F")
      ? "PROMOTED"
      : "REPEATED";

  const reportCard = await prisma.reportCard.upsert({
    where: {
      studentId_sessionId_termId: {
        studentId: opts.studentId,
        sessionId: opts.sessionId,
        termId: opts.termId,
      },
    },
    update: {
      overallAverage,
      overallGrade,
      classPosition,
      totalStudents,
      promotionStatus: opts.forceRegenerate ? suggested : undefined,
      classId: student.classId,
      generatedById: opts.generatedById ?? undefined,
    },
    create: {
      studentId: opts.studentId,
      classId: student.classId,
      sessionId: opts.sessionId,
      termId: opts.termId,
      overallAverage,
      overallGrade,
      classPosition,
      totalStudents,
      promotionStatus: suggested,
      generatedById: opts.generatedById ?? null,
    },
    include: {
      student: true,
      session: true,
      term: true,
      class: true,
    },
  });

  return {
    reportCardId: reportCard.id,
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      admissionNumber: student.admissionNumber,
      profileImage: student.profileImage,
      gender: student.gender,
    },
    school: {
      name: student.school.name,
      motto: student.school.motto,
      logo: student.school.logo,
      address: student.school.address,
      principal: student.school.principal,
    },
    sessionName: session.name,
    termName: term.name,
    className: student.class?.name ?? "—",
    attendance: {
      present,
      absent,
      late,
      excused,
      total: attendance.length,
      rate: attendance.length > 0 ? round2((present / attendance.length) * 100) : 100,
    },
    results: mappedResults,
    overallAverage,
    overallGrade,
    classPosition,
    totalStudents,
    promotionStatus: reportCard.promotionStatus,
    classTeacherComment: reportCard.classTeacherComment,
    principalComment: reportCard.principalComment,
    verificationCode: reportCard.verificationCode,
    isPublished: reportCard.isPublished,
    publishedAt: reportCard.publishedAt,
  };
}
