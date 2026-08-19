import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, examGenSchema } from "@/lib/validations";
import { aiComplete, parseJsonLoose, resolvePrompt } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";
import type { Prisma, UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];

const str = (v: unknown, d = "") => (typeof v === "string" && v.trim() ? v.trim() : d);

/**
 * POST /api/ai/exams — AI Exam Generator (Module 7).
 * Produces a complete examination (instructions, sections, marking scheme,
 * answer key, difficulty coverage) and persists it as GeneratedExam.
 */
export async function POST(req: Request) {
  try {
    const guard = await aiGuard({ module: "exam_generator", roles: STAFF_ROLES });
    if (guard instanceof NextResponse) return guard;
    const { schoolId, userId } = guard;
  
    const body = await parseJsonBody(req).catch(() => null);
    const parsed = validate(examGenSchema, body ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { subject, className, topic, durationMins, bloom } = parsed.data;
  
    const prompt = await resolvePrompt(schoolId, "exam_generator", {
      subject,
      className: className ?? "general class",
      topic,
      durationMins: String(durationMins),
      bloom: bloom ?? "Remember, Understand, Apply, Analyze, Evaluate, Create",
    });
  
    const result = await aiComplete({
      schoolId,
      userId,
      module: "exam_generator",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
    });
  
    const raw = (parseJsonLoose(result.text) ?? {}) as Record<string, unknown>;
    if (!Array.isArray(raw.sections) || raw.sections.length === 0 || !str(raw.title)) {
      return NextResponse.json({ error: "The AI returned an invalid exam. Please try again." }, { status: 502 });
    }
  
    const subjectRow = await prisma.subject.findFirst({ where: { schoolId, name: { contains: subject, mode: "insensitive" } } });
    const classRow = className
      ? await prisma.class.findFirst({ where: { schoolId, name: { contains: className, mode: "insensitive" } } })
      : null;
  
    const exam = await prisma.generatedExam.create({
      data: {
        title: str(raw.title),
        instructions: str(raw.instructions) || null,
        durationMins,
        sections: raw.sections as Prisma.InputJsonValue,
        markingScheme: Array.isArray(raw.markingScheme) ? (raw.markingScheme as Prisma.InputJsonValue) : undefined,
        answerKey: Array.isArray(raw.answerKey) ? (raw.answerKey as Prisma.InputJsonValue) : undefined,
        difficultyCoverage: Array.isArray(raw.difficultyCoverage) ? (raw.difficultyCoverage as Prisma.InputJsonValue) : undefined,
        schoolId,
        subjectId: subjectRow?.id ?? null,
        classId: classRow?.id ?? null,
        createdById: userId,
      },
    });
  
    return NextResponse.json({ exam });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}

/** GET /api/ai/exams — generated exams list. */
export async function GET() {
  try {
    const guard = await aiGuard({ module: "exam_generator", roles: STAFF_ROLES, budgetCheck: false });
    if (guard instanceof NextResponse) return guard;
    const { schoolId } = guard;
  
    const exams = await prisma.generatedExam.findMany({
      where: { schoolId },
      include: { subject: { select: { name: true } }, class: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  
    return NextResponse.json({
      exams: exams.map((e) => ({
        id: e.id,
        title: e.title,
        subject: e.subject?.name ?? null,
        className: e.class?.name ?? null,
        durationMins: e.durationMins,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}
