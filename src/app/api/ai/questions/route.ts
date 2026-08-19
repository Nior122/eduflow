import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validate, questionGenSchema, questionTypes } from "@/lib/validations";
import { aiComplete, parseJsonLoose, resolvePrompt } from "@/lib/ai/core";
import { aiGuard } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/errors";
import type { Prisma, UserRole } from "@prisma/client";

const STAFF_ROLES: UserRole[] = ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"];
const TYPE_SET = new Set<string>(questionTypes);
const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"]);

const str = (v: unknown, d = "") => (typeof v === "string" && v.trim() ? v.trim() : d);
const num = (v: unknown, d = 1) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 10) : d;
};

/**
 * POST /api/ai/questions — AI Question Generator (Module 6).
 * Generates a validated set of questions, saves them to the QuestionBank
 * and returns them for editing/export.
 */
export async function POST(req: Request) {
  try {
    const guard = await aiGuard({ module: "question_generator", roles: STAFF_ROLES });
    if (guard instanceof NextResponse) return guard;
    const { schoolId, userId } = guard;
  
    const body = await req.json().catch(() => null);
    const parsed = validate(questionGenSchema, body ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { subject, className, topic, difficulty, count, types } = parsed.data;
  
    const prompt = await resolvePrompt(schoolId, "question_generator", {
      subject,
      className: className ?? "general class",
      topic,
      count: String(count),
      difficulty: difficulty.toLowerCase(),
      types: types.join(", "),
    });
  
    const result = await aiComplete({
      schoolId,
      userId,
      module: "question_generator",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
    });
  
    const raw = parseJsonLoose(result.text);
    const rows = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : Array.isArray((raw as Record<string, unknown> | null)?.questions)
        ? (((raw as Record<string, unknown>).questions as unknown[]) as Record<string, unknown>[])
        : null;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "The AI returned no valid questions. Please try again." }, { status: 502 });
    }
  
    const clean = rows.slice(0, Math.min(count, 20)).map((r) => ({
      type: TYPE_SET.has(str(r.type).toUpperCase()) ? (str(r.type).toUpperCase() as (typeof questionTypes)[number]) : "MCQ",
      difficulty: DIFFICULTIES.has(str(r.difficulty).toUpperCase()) ? (str(r.difficulty).toUpperCase() as "EASY" | "MEDIUM" | "HARD") : difficulty,
      question: str(r.question),
      options: r.options && typeof r.options === "object" ? (r.options as Prisma.InputJsonValue) : undefined,
      answer: str(r.answer),
      explanation: str(r.explanation) || null,
      marks: num(r.marks, 1),
    })).filter((q) => q.question && q.answer);
  
    if (clean.length === 0) {
      return NextResponse.json({ error: "The AI returned no valid questions. Please try again." }, { status: 502 });
    }
  
    const subjectRow = await prisma.subject.findFirst({ where: { schoolId, name: { contains: subject, mode: "insensitive" } } });
    const classRow = className
      ? await prisma.class.findFirst({ where: { schoolId, name: { contains: className, mode: "insensitive" } } })
      : null;
  
    await prisma.questionBank.createMany({
      data: clean.map((q) => ({
        ...q,
        topic,
        schoolId,
        subjectId: subjectRow?.id ?? null,
        classId: classRow?.id ?? null,
        createdById: userId,
        aiGenerated: true,
      })),
    });
  
    return NextResponse.json({ count: clean.length, questions: clean, saved: true });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}

/** GET /api/ai/questions — saved question bank with filters. */
export async function GET(req: Request) {
  try {
    const guard = await aiGuard({ module: "question_generator", roles: STAFF_ROLES, budgetCheck: false });
    if (guard instanceof NextResponse) return guard;
    const { schoolId } = guard;
  
    const url = new URL(req.url);
    const where: Prisma.QuestionBankWhereInput = { schoolId };
    const q = url.searchParams.get("q")?.trim();
    const type = url.searchParams.get("type");
    const difficulty = url.searchParams.get("difficulty");
    if (q) where.question = { contains: q, mode: "insensitive" };
    if (type && TYPE_SET.has(type)) where.type = type as never;
    if (difficulty && DIFFICULTIES.has(difficulty)) where.difficulty = difficulty as never;
  
    const questions = await prisma.questionBank.findMany({
      where,
      include: { subject: { select: { name: true } }, class: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  
    return NextResponse.json({
      questions: questions.map((x) => ({
        id: x.id,
        type: x.type,
        difficulty: x.difficulty,
        question: x.question,
        options: x.options,
        answer: x.answer,
        explanation: x.explanation,
        marks: x.marks,
        topic: x.topic,
        subject: x.subject?.name ?? null,
        className: x.class?.name ?? null,
        createdAt: x.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return aiErrorResponse(error, "The AI service is temporarily unavailable. Please try again.");
  }
}
