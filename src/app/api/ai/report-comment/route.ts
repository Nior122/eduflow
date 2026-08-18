import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, reportCommentSchema } from "@/lib/validations";
import { aiComplete, resolvePrompt } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";
import type { UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

/**
 * POST /api/ai/report-comment — AI Report Comment Generator (Module 3).
 * When a studentId is provided, real performance data is loaded and
 * previous comments are passed along so the model does not repeat them.
 */
export async function POST(req: Request) {
  const guard = await aiGuard({ module: "report_comment", roles: STAFF_ROLES });
  if (guard instanceof NextResponse) return guard;
  try {
    const { session, schoolId, userId } = guard;
  
    const body = await req.json().catch(() => null);
    const parsed = validate(reportCommentSchema, body ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const input = parsed.data;
  
    let name = input.name ?? "the student";
    let average = "";
    let attendance = input.attendance;
    let behaviour = input.behaviour ?? "Good";
    let previousComments = "none";
    let homeworkCompletion = "N/A";
  
    if (input.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: input.studentId, schoolId, isActive: true },
        include: { class: { select: { name: true } } },
      });
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  
      name = `${student.firstName} ${student.lastName}`;
      const [results, attendances, prior] = await Promise.all([
        prisma.result.findMany({
          where: { studentId: student.id, status: { in: ["PUBLISHED", "LOCKED"] } },
          include: { subject: { select: { name: true } } },
          take: 60,
        }),
        prisma.attendance.findMany({ where: { studentId: student.id }, select: { status: true }, take: 90 }),
        prisma.aIReportComment.findMany({
          where: { studentId: student.id },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { content: true },
        }),
      ]);
  
      const totals = results.map((r) => Number(r.total ?? 0)).filter((n) => !Number.isNaN(n));
      if (totals.length) average = String(Math.round(totals.reduce((a, b) => a + b, 0) / totals.length));
      const present = attendances.filter((a) => a.status === "PRESENT").length;
      if (attendances.length) attendance = Math.round((present / attendances.length) * 100);
      previousComments = prior.map((p) => `"${p.content.slice(0, 140)}"`).join(", ") || "none";
      behaviour = student.class?.name ? `Class: ${student.class.name}` : "Good";
      homeworkCompletion = "N/A";
    } else if (input.mathScore != null && input.englishScore != null) {
      const m = Number(input.mathScore) || 0;
      const e = Number(input.englishScore) || 0;
      average = String(Math.round((m + e) / 2));
    }
  
    const performanceLevel =
      input.commentType ??
      (average ? (Number(average) >= 70 ? "EXCELLENT" : Number(average) >= 55 ? "AVERAGE" : "NEEDS_IMPROVEMENT") : "AVERAGE");
  
    const prompt = await resolvePrompt(schoolId, "report_comment", {
      name,
      performanceLevel,
      average: average || "N/A",
      attendance: String(attendance ?? "N/A"),
      homeworkCompletion,
      behaviour,
      term: input.term ?? "this term",
      previousComments,
    });
  
    const result = await aiComplete({
      schoolId,
      userId,
      module: "report_comment",
      messages: [{ role: "user", content: prompt }],
    });
  
    return NextResponse.json({ comment: result.text.trim(), commentType: performanceLevel });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}
